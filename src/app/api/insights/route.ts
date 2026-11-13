/**
 * GET /api/insights — derived intelligence over the user's posted transactions.
 *
 * Everything is computed with BigInt minor units (no floats) and cached for
 * 30 seconds per user. Returns:
 *   - cashflowSeries: last 6 months of inflow/outflow by month
 *   - topMerchants: outflow concentration over the last 90 days
 *   - categoryBreakdown: last 30 days by category
 *   - burnRate: trailing 30-day daily burn + projected end-of-month
 *   - recurring: detected subscriptions (same merchant, similar amount,
 *     seen in >= 3 distinct months) with an estimated monthly cost
 *
 * Detection is deterministic — no ML, fully explainable, and it degrades to
 * an empty list when there isn't enough history rather than guessing.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";

export const dynamic = "force-dynamic";

type CacheEntry = { value: unknown; at: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 30_000;

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to view insights.", 401), { status: 401 });
  }

  const hit = cache.get(user.id);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.value);
  }

  const now = new Date();
  const lookback = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  const txs = await db.transaction.findMany({
    where: {
      userId: user.id,
      status: "posted",
      occurredAt: { gte: lookback },
    },
    select: {
      occurredAt: true,
      merchantName: true,
      description: true,
      amountMinor: true,
      direction: true,
      currency: true,
      categoryId: true,
      category: { select: { name: true, kind: true, color: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: 5000,
  });

  const baseCurrency = user.baseCurrency;
  const relevant = txs.filter((t) => t.currency === baseCurrency);

  // ---- 1. Monthly cashflow series (last 6 months) ----
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(monthKey(d));
  }
  const series = new Map<string, { inflowMinor: bigint; outflowMinor: bigint }>();
  for (const m of months) series.set(m, { inflowMinor: 0n, outflowMinor: 0n });
  for (const t of relevant) {
    const k = monthKey(t.occurredAt);
    const bucket = series.get(k);
    if (!bucket) continue;
    if (t.direction === "inflow") bucket.inflowMinor += t.amountMinor;
    else bucket.outflowMinor += -t.amountMinor; // outflow amounts are negative
  }

  // ---- 2. Top merchants (90 days, outflows) ----
  const cutoff90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const merchantTotals = new Map<string, { minor: bigint; count: number }>();
  for (const t of relevant) {
    if (t.direction !== "outflow" || t.occurredAt < cutoff90) continue;
    const name = (t.merchantName ?? t.description).slice(0, 40);
    const cur = merchantTotals.get(name) ?? { minor: 0n, count: 0 };
    cur.minor += -t.amountMinor;
    cur.count += 1;
    merchantTotals.set(name, cur);
  }
  const totalOut90 = [...merchantTotals.values()].reduce((a, b) => a + b.minor, 0n);
  const topMerchants = [...merchantTotals.entries()]
    .sort((a, b) => (b[1].minor > a[1].minor ? 1 : b[1].minor < a[1].minor ? -1 : 0))
    .slice(0, 6)
    .map(([name, v]) => ({
      merchant: name,
      outflowMinor: v.minor.toString(),
      txnCount: v.count,
      sharePct: totalOut90 > 0n ? Number((v.minor * 1000n) / totalOut90) / 10 : 0,
    }));

  // ---- 3. Category breakdown (30 days) ----
  const cutoff30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const catTotals = new Map<string, { minor: bigint; color: string | null }>();
  for (const t of relevant) {
    if (t.direction !== "outflow" || t.occurredAt < cutoff30) continue;
    const key = t.category?.name ?? "Uncategorized";
    const cur = catTotals.get(key) ?? { minor: 0n, color: t.category?.color ?? null };
    cur.minor += -t.amountMinor;
    catTotals.set(key, cur);
  }
  const totalOut30 = [...catTotals.values()].reduce((a, b) => a + b.minor, 0n);
  const categoryBreakdown = [...catTotals.entries()]
    .sort((a, b) => (b[1].minor > a[1].minor ? 1 : b[1].minor < a[1].minor ? -1 : 0))
    .slice(0, 8)
    .map(([name, v]) => ({
      category: name,
      outflowMinor: v.minor.toString(),
      sharePct: totalOut30 > 0n ? Number((v.minor * 1000n) / totalOut30) / 10 : 0,
      color: v.color,
    }));

  // ---- 4. Burn rate (trailing 30 days) ----
  const burnOutflow = totalOut30;
  const daysElapsed = Math.max(
    1,
    Math.min(30, Math.floor((now.getTime() - cutoff30.getTime()) / (24 * 60 * 60 * 1000))),
  );
  const dailyBurn = burnOutflow / BigInt(daysElapsed);
  const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const daysRemaining = Math.max(
    0,
    Math.ceil((endOfMonth.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
  );
  const projectedMonthOutflow = burnOutflow + dailyBurn * BigInt(Math.max(1, daysRemaining));

  // ---- 5. Recurring candidates ----
  // Group outflows by normalized merchant; require >= 3 distinct months and
  // amount consistency (each observation within 20% of the median).
  const perMerchant = new Map<string, { months: Set<string>; amounts: bigint[]; labels: Set<string> }>();
  for (const t of relevant) {
    if (t.direction !== "outflow") continue;
    const raw = (t.merchantName ?? t.description).trim();
    if (!raw) continue;
    const norm = raw.toLowerCase().replace(/\s+/g, " ").replace(/#\d+/g, "").replace(/\d{4,}/g, "").trim();
    if (norm.length < 3) continue;
    const cur = perMerchant.get(norm) ?? { months: new Set<string>(), amounts: [], labels: new Set<string>() };
    cur.months.add(monthKey(t.occurredAt));
    cur.amounts.push(-t.amountMinor);
    cur.labels.add(raw.slice(0, 30));
    perMerchant.set(norm, cur);
  }

  const recurring = [];
  for (const [norm, v] of perMerchant) {
    if (v.months.size < 3 || v.amounts.length < 3) continue;
    const sorted = [...v.amounts].sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median === 0n) continue;
    const within = v.amounts.every((a) => {
      const diff = a > median ? a - median : median - a;
      return diff * 5n <= median; // within 20%
    });
    if (!within) continue;
    recurring.push({
      merchant: [...v.labels][0] ?? norm,
      occurrences: v.amounts.length,
      monthsSeen: v.months.size,
      medianAmountMinor: median.toString(),
      estimatedMonthlyMinor: median.toString(),
    });
  }
  recurring.sort((a, b) => (BigInt(a.medianAmountMinor) > BigInt(b.medianAmountMinor) ? -1 : 1));
  const recurringTop = recurring.slice(0, 8);
  const recurringMonthlyTotal = recurringTop.reduce((acc, r) => acc + BigInt(r.medianAmountMinor), 0n);

  const payload = {
    currency: baseCurrency,
    generatedAt: now.toISOString(),
    coverage: {
      transactionsAnalyzed: relevant.length,
      otherCurrencyCount: txs.length - relevant.length,
      lookbackDays: 180,
    },
    cashflowSeries: months.map((m) => {
      const b = series.get(m)!;
      return { month: m, inflowMinor: b.inflowMinor.toString(), outflowMinor: b.outflowMinor.toString(), netMinor: (b.inflowMinor - b.outflowMinor).toString() };
    }),
    topMerchants,
    categoryBreakdown,
    burnRate: {
      trailing30dOutflowMinor: burnOutflow.toString(),
      dailyBurnMinor: dailyBurn.toString(),
      daysRemainingInMonth: daysRemaining,
      projectedMonthOutflowMinor: projectedMonthOutflow.toString(),
    },
    recurring: {
      items: recurringTop,
      estimatedMonthlyTotalMinor: recurringMonthlyTotal.toString(),
      method: "deterministic: same merchant in >= 3 months, amounts within 20% of median",
    },
  };

  cache.set(user.id, { value: payload, at: Date.now() });
  return NextResponse.json(payload);
}
