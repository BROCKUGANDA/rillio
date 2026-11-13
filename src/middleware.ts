/**
 * Rillio edge middleware — critical infrastructure layer.
 *
 * Responsibilities:
 *   1. Request-id propagation (x-request-id → every log line and RFC 7807 error)
 *   2. Security headers on every response (CSP, frame denial, MIME sniffing,
 *      referrer, permissions policy, HSTS)
 *   3. Rate limiting on /api/* with sliding windows (lib/rate-limit.ts) and
 *      RFC 7807 problem responses on 429
 *
 * Runs before any route handler; matches all paths except static assets.
 */

import { NextResponse, type NextRequest } from "next/server";
import { bucketForMethod, principalFor, checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "off",
  // CSP: app is fully self-contained (fonts bundled, no third-party scripts).
  // 'unsafe-eval' required by Next dev; 'unsafe-inline' for Next hydration scripts.
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.mainnet-beta.solana.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "),
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(k, v);
  }
  return response;
}

export function middleware(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  // ---- Rate limiting: API surface only ----
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const bucket = bucketForMethod(request.method, request.nextUrl.pathname);
    const principal = principalFor(request as unknown as Request);
    const result = checkRateLimit(principal, bucket);

    if (!result.ok) {
      const problem = {
        type: "https://api.rillio.example/problems/rate_limit_exceeded",
        title: "Too many requests",
        status: 429,
        code: "RATE_LIMIT_EXCEEDED",
        detail: `You exceeded ${result.limit} requests per window for this resource. Retry after ${result.retryAfterSec}s.`,
        requestId,
        retryable: true,
      };
      const res = NextResponse.json(problem, { status: 429 });
      res.headers.set("x-request-id", requestId);
      for (const [k, v] of Object.entries(rateLimitHeaders(result))) res.headers.set(k, v);
      return applySecurityHeaders(res);
    }

    // Pass through, preserving the request id for route handlers.
    const headers = new Headers(request.headers);
    headers.set("x-request-id", requestId);
    const res = NextResponse.next({ request: { headers } });
    res.headers.set("x-request-id", requestId);
    for (const [k, v] of Object.entries(rateLimitHeaders(result))) res.headers.set(k, v);
    return applySecurityHeaders(res);
  }

  // ---- Non-API: security headers only ----
  const res = NextResponse.next();
  res.headers.set("x-request-id", requestId);
  return applySecurityHeaders(res);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
