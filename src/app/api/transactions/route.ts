import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { minorToChartNumber } from "@/lib/money";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
  const cursor = url.searchParams.get("cursor");
  const categoryId = url.searchParams.get("categoryId");
  const startDate = url.searchParams.get("start");
  const endDate = url.searchParams.get("end");
  const direction = url.searchParams.get("direction");

  const where: Record<string, unknown> = { userId: user.id };
  if (categoryId) where.categoryId = categoryId;
  if (direction) where.direction = direction;
  if (startDate || endDate) {
    where.occurredAt = {};
    if (startDate) (where.occurredAt as Record<string, unknown>).gte = new Date(startDate);
    if (endDate) (where.occurredAt as Record<string, unknown>).lte = new Date(endDate);
  }

  const transactions = await db.transaction.findMany({
    where: where as never,
    orderBy: { occurredAt: "desc" },
    take: limit + 1,
    skip: cursor ? 1 : 0,
    ...(cursor ? { cursor: { id: cursor } } : {}),
    include: { category: true },
  });

  const hasMore = transactions.length > limit;
  const items = hasMore ? transactions.slice(0, limit) : transactions;

  return NextResponse.json({
    data: items.map((t) => ({
      id: t.id,
      occurredAt: t.occurredAt,
      description: t.description,
      merchantName: t.merchantName,
      amountMinor: t.amountMinor.toString(),
      currency: t.currency,
      direction: t.direction,
      status: t.status,
      category: t.category ? { id: t.category.id, name: t.category.name, kind: t.category.kind } : null,
      sourceProvider: t.sourceProvider,
    })),
    nextCursor: hasMore ? items[items.length - 1].id : null,
    hasMore,
  });
}

// Bulk summary for the dashboard
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { periodStart, periodEnd } = body as { periodStart?: string; periodEnd?: string };

  const where: Record<string, unknown> = { userId: user.id };
  if (periodStart || periodEnd) {
    where.occurredAt = {};
    if (periodStart) (where.occurredAt as Record<string, unknown>).gte = new Date(periodStart);
    if (periodEnd) (where.occurredAt as Record<string, unknown>).lte = new Date(periodEnd);
  }

  const transactions = await db.transaction.findMany({
    where: where as never,
    include: { category: true },
    orderBy: { occurredAt: "desc" },
  });

  // Aggregate by category + direction
  const byCategory = new Map<string, { name: string; kind: string; inflow: bigint; outflow: bigint; count: number }>();
  let inflow = 0n;
  let outflow = 0n;
  for (const t of transactions) {
    const key = t.category?.id ?? "uncategorized";
    const cat = t.category?.name ?? "Uncategorized";
    const kind = t.category?.kind ?? "expense";
    if (!byCategory.has(key)) {
      byCategory.set(key, { name: cat, kind, inflow: 0n, outflow: 0n, count: 0 });
    }
    const c = byCategory.get(key)!;
    if (t.direction === "inflow") {
      c.inflow += t.amountMinor > 0n ? t.amountMinor : -t.amountMinor;
      inflow += t.amountMinor > 0n ? t.amountMinor : -t.amountMinor;
    } else {
      c.outflow += t.amountMinor > 0n ? t.amountMinor : -t.amountMinor;
      outflow += t.amountMinor > 0n ? t.amountMinor : -t.amountMinor;
    }
    c.count++;
  }

  // Group by day for trend
  const byDay = new Map<string, { date: string; inflow: number; outflow: number }>();
  for (const t of transactions) {
    const day = t.occurredAt.toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, { date: day, inflow: 0, outflow: 0 });
    const d = byDay.get(day)!;
    const abs = minorToChartNumber(t.amountMinor < 0n ? -t.amountMinor : t.amountMinor, t.currency);
    if (t.direction === "inflow") d.inflow += abs;
    else d.outflow += abs;
  }

  // Detect recurring merchants
  const merchantCounts = new Map<string, { count: number; total: bigint }>();
  for (const t of transactions) {
    if (!t.merchantName && !t.description) continue;
    const name = (t.merchantName || t.description).toLowerCase();
    if (!merchantCounts.has(name)) merchantCounts.set(name, { count: 0, total: 0n });
    const m = merchantCounts.get(name)!;
    m.count++;
    m.total += t.amountMinor < 0n ? -t.amountMinor : t.amountMinor;
  }
  const recurring = Array.from(merchantCounts.entries())
    .filter(([_, m]) => m.count >= 3)
    .map(([name, m]) => ({ merchant: name, count: m.count, totalMinor: m.total.toString() }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return NextResponse.json({
    totalTransactions: transactions.length,
    inflowMinor: inflow.toString(),
    outflowMinor: outflow.toString(),
    netMinor: (inflow - outflow).toString(),
    currency: user.baseCurrency,
    byCategory: Array.from(byCategory.entries()).map(([id, c]) => ({
      categoryId: id,
      name: c.name,
      kind: c.kind,
      inflowMinor: c.inflow.toString(),
      outflowMinor: c.outflow.toString(),
      count: c.count,
    })),
    byDay: Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
    recurring,
    periodStart: periodStart ?? null,
    periodEnd: periodEnd ?? null,
  });
}
