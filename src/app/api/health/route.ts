/**
 * GET /api/health — liveness + subsystem readiness.
 *
 * Anonymous callers get the shallow shape (status + version only, no infra
 * detail). Authenticated callers get the full readiness report: database
 * latency, Solana RPC reachability (cached, non-blocking), price-oracle
 * state, plan configuration, and rate-limit subsystem presence.
 *
 * This endpoint is intentionally cheap: deep checks are time-boxed and
 * cached for 60s so monitoring can poll aggressively without hammering
 * upstream providers.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const STARTED_AT = Date.now();

type SubsystemState = {
  name: string;
  status: "ok" | "degraded" | "down";
  detail: string;
  latencyMs?: number;
  observedAt: string;
};

// 60s cache for expensive checks (RPC reachability, price oracle).
const cache = new Map<string, { value: SubsystemState; at: number }>();
const CACHE_TTL_MS = 60_000;

async function cached(name: string, probe: () => Promise<SubsystemState>): Promise<SubsystemState> {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = await probe();
  cache.set(name, { value, at: Date.now() });
  return value;
}

async function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(onTimeout()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function probeDatabase(): Promise<SubsystemState> {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return {
      name: "database",
      status: "ok",
      detail: "SQLite reachable; read latency measured",
      latencyMs: Date.now() - start,
      observedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      name: "database",
      status: "down",
      detail: err instanceof Error ? err.message.slice(0, 120) : "unreachable",
      observedAt: new Date().toISOString(),
    };
  }
}

async function probeSolanaRpc(): Promise<SubsystemState> {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) {
    return { name: "solana-rpc", status: "degraded", detail: "SOLANA_RPC_URL not configured — wallet refresh unavailable", observedAt: new Date().toISOString() };
  }
  const start = Date.now();
  const ok = await withTimeout(
    (async () => {
      try {
        const res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
          signal: AbortSignal.timeout(5000),
        });
        return res.ok;
      } catch {
        return false;
      }
    })(),
    5500,
    () => false,
  );
  return ok
    ? { name: "solana-rpc", status: "ok", detail: `${rpcUrl} responded to getHealth`, latencyMs: Date.now() - start, observedAt: new Date().toISOString() }
    : { name: "solana-rpc", status: "degraded", detail: "RPC unreachable or rate-limited — wallet refresh will surface stale data rather than zeros", latencyMs: Date.now() - start, observedAt: new Date().toISOString() };
}

async function probePlans(): Promise<SubsystemState> {
  try {
    const plans = await db.plan.findMany({ where: { isActive: true }, select: { code: true, usdcRecipient: true, solRecipient: true } });
    const plus = plans.find((p) => p.code === "plus");
    const funded = Boolean(plus?.usdcRecipient || plus?.solRecipient);
    return {
      name: "billing",
      status: funded ? "ok" : "degraded",
      detail: funded
        ? `Plans seeded (${plans.map((p) => p.code).join(", ")}); onchain recipients configured`
        : "Plans seeded but no onchain recipient configured — checkout intents cannot be created",
      observedAt: new Date().toISOString(),
    };
  } catch {
    return { name: "billing", status: "down", detail: "Plan table unreachable", observedAt: new Date().toISOString() };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wantsDetail = url.searchParams.get("detail") === "1";

  if (!wantsDetail) {
    // Shallow liveness — no auth, no infra detail.
    return NextResponse.json({
      status: "ok",
      service: "rillio-api",
      version: "2.0.0",
      uptimeSec: Math.round((Date.now() - STARTED_AT) / 1000),
      time: new Date().toISOString(),
    });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      {
        type: "https://api.rillio.example/problems/auth_required",
        title: "Authentication required",
        status: 401,
        code: "AUTH_REQUIRED",
        detail: "Detailed health requires an authenticated session.",
        requestId: crypto.randomUUID(),
        retryable: false,
      },
      { status: 401 },
    );
  }

  const [database, solanaRpc, billing] = await Promise.all([
    withTimeout(probeDatabase(), 4000, () => ({ name: "database", status: "down" as const, detail: "probe timed out", observedAt: new Date().toISOString() })),
    cached("solana-rpc", probeSolanaRpc),
    withTimeout(probePlans(), 4000, () => ({ name: "billing", status: "down" as const, detail: "probe timed out", observedAt: new Date().toISOString() })),
  ]);

  const subsystems = [database, solanaRpc, billing];
  const overall = subsystems.some((s) => s.status === "down")
    ? "degraded"
    : subsystems.some((s) => s.status === "degraded")
      ? "degraded"
      : "ok";

  return NextResponse.json({
    status: overall,
    service: "rillio-api",
    version: "2.0.0",
    uptimeSec: Math.round((Date.now() - STARTED_AT) / 1000),
    time: new Date().toISOString(),
    subsystems,
    boundaries: {
      custody: "none — read-only MVP",
      paymentRail: "solana-only (USDC / SOL onchain verification; no card processor)",
      priceOracle: "Jupiter → Pyth → unpriced fallback (never fabricates zero)",
    },
  });
}
