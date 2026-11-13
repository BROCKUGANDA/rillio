/**
 * Rate limiting tests — blueprint §17 (abuse controls), §16.2.
 *
 * The limiter is in-process and per-instance. These tests pin the window
 * behaviour, per-bucket separation, and that a 429 is distinguishable from an
 * allowed request so the middleware can return RFC 7807 + Retry-After.
 */

import { describe, it, expect } from "vitest";
import { checkRateLimit, bucketForMethod, BUCKET_LIMITS } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows requests up to the limit then blocks", () => {
    const bucket = "auth";
    const limit = BUCKET_LIMITS[bucket].limit;
    const now = 1_700_000_000_000;
    const principal = "test:limit";

    for (let i = 0; i < limit; i++) {
      const r = checkRateLimit(principal, bucket, now);
      expect(r.ok).toBe(true);
    }
    const blocked = checkRateLimit(principal, bucket, now);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const bucket = "auth";
    const { windowMs } = BUCKET_LIMITS[bucket];
    const now = 1_700_000_000_000;
    const principal = "test:window";

    for (let i = 0; i < BUCKET_LIMITS[bucket].limit; i++) checkRateLimit(principal, bucket, now);
    expect(checkRateLimit(principal, bucket, now).ok).toBe(false);

    // After the window, the counter starts over.
    expect(checkRateLimit(principal, bucket, now + windowMs + 1).ok).toBe(true);
  });

  it("keeps buckets independent per principal", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < BUCKET_LIMITS.read.limit; i++) checkRateLimit("p:read", "read", now);
    expect(checkRateLimit("p:read", "read", now).ok).toBe(false);
    // A different principal is unaffected.
    expect(checkRateLimit("p:other", "read", now).ok).toBe(true);
  });

  it("separates buckets for the same principal", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < BUCKET_LIMITS.auth.limit; i++) checkRateLimit("p:mix", "auth", now);
    expect(checkRateLimit("p:mix", "auth", now).ok).toBe(false);
    // A different bucket for the same principal is still allowed.
    expect(checkRateLimit("p:mix", "read", now).ok).toBe(true);
  });
});

describe("bucketForMethod", () => {
  it("routes auth endpoints to the strictest bucket", () => {
    expect(bucketForMethod("POST", "/api/auth/login")).toBe("auth");
    expect(bucketForMethod("POST", "/api/auth/register")).toBe("auth");
    expect(bucketForMethod("POST", "/api/auth/logout")).toBe("auth");
  });

  it("routes money and RPC-heavy endpoints to their own buckets", () => {
    expect(bucketForMethod("POST", "/api/billing/usdc/verify-payment")).toBe("billing");
    expect(bucketForMethod("GET", "/api/wallets")).toBe("wallets");
    expect(bucketForMethod("POST", "/api/imports")).toBe("imports");
    expect(bucketForMethod("GET", "/api/imports")).toBe("read");
    expect(bucketForMethod("POST", "/api/me/data-export")).toBe("exports");
  });

  it("defaults reads and writes to their generic buckets", () => {
    expect(bucketForMethod("GET", "/api/transactions")).toBe("read");
    expect(bucketForMethod("PATCH", "/api/transactions/123/category")).toBe("mutations");
    expect(bucketForMethod("DELETE", "/api/wallets/123")).toBe("wallets");
  });
});