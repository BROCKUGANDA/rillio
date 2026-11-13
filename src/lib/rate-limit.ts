/**
 * Rillio — in-process rate limiting (critical infra layer).
 *
 * Sliding-window counter keyed by principal (session token hash or IP) plus
 * route bucket. Best-effort per-instance limiting: sufficient for single-node
 * MVP; a production deployment swaps the store for Redis with the same
 * interface. Limits are deliberately conservative on auth and money routes.
 *
 * Response contract: RFC 7807 problem envelope (lib/errors.ts) with
 * RateLimit + Retry-After headers so well-behaved clients can back off.
 */

export type RateLimitBucket =
  | "auth" // login/register/logout — credential stuffing + brute force
  | "imports" // CSV upload — heavy parse work
  | "billing" // checkout + verification — money-adjacent
  | "wallets" // RPC-backed refresh — protects upstream Solana RPC quota
  | "connections" // provider sync — heavy
  | "exports" // data export — expensive serialization
  | "mutations" // generic POST/PATCH/DELETE
  | "read"; // generic GET

export const BUCKET_LIMITS: Record<RateLimitBucket, { limit: number; windowMs: number }> = {
  auth: { limit: 10, windowMs: 60_000 },
  imports: { limit: 12, windowMs: 60_000 },
  billing: { limit: 20, windowMs: 60_000 },
  wallets: { limit: 30, windowMs: 60_000 },
  connections: { limit: 30, windowMs: 60_000 },
  exports: { limit: 6, windowMs: 60_000 },
  mutations: { limit: 60, windowMs: 60_000 },
  read: { limit: 240, windowMs: 60_000 },
};

type Hit = { count: number; windowStart: number };

// key -> latest hit record. Fixed max size with FIFO eviction so the map
// cannot grow unbounded under key churn (spoofed IPs etc.).
const store = new Map<string, Hit>();
const MAX_KEYS = 10_000;

export function bucketForMethod(method: string, pathname: string): RateLimitBucket {
  const p = pathname;
  // Explicit overrides first — more specific buckets win over method defaults.
  if (p.startsWith("/api/auth")) return "auth";
  if (p.startsWith("/api/imports")) return method === "GET" ? "read" : "imports";
  if (p.startsWith("/api/billing")) return "billing";
  if (p.startsWith("/api/wallets")) return "wallets";
  if (p.startsWith("/api/connections")) return "connections";
  if (p.startsWith("/api/me/data-export") || p.startsWith("/api/me/deletion-request")) return "exports";
  if (method === "GET" || method === "HEAD") return "read";
  return "mutations";
}

/**
 * Principal identity for rate limiting. Prefers the session cookie hash so a
 * shared NAT IP doesn't penalize many users; falls back to IP for anonymous
 * traffic (auth routes before a session exists).
 */
export function principalFor(request: Request): string {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)rillio_session=([^;]+)/);
  if (match) return `s:${hash(match[1])}`;
  const fwd =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `ip:${fwd}`;
}

function hash(input: string): string {
  // FNV-1a 32-bit — enough to anonymize tokens, cheap, allocation-free.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
  resetAt: number;
};

export function checkRateLimit(
  principal: string,
  bucket: RateLimitBucket,
  now: number = Date.now(),
): RateLimitResult {
  const { limit, windowMs } = BUCKET_LIMITS[bucket];
  const key = `${bucket}:${principal}`;

  // FIFO eviction when the store is saturated.
  if (store.size >= MAX_KEYS) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }

  const hit = store.get(key);
  if (!hit || now - hit.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { ok: true, limit, remaining: limit - 1, retryAfterSec: 0, resetAt: now + windowMs };
  }

  hit.count += 1;
  const resetAt = hit.windowStart + windowMs;
  const remaining = Math.max(0, limit - hit.count);
  const retryAfterSec = Math.max(1, Math.ceil((resetAt - now) / 1000));
  return { ok: hit.count <= limit, limit, remaining, retryAfterSec, resetAt };
}

/** Standard headers for every API response (429 or not). */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.ok ? {} : { "Retry-After": String(result.retryAfterSec) }),
  };
}
