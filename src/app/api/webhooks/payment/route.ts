import { NextRequest, NextResponse } from "next/server";
import { settleSubscription } from "@/lib/billing/settle";
import { db } from "@/lib/db";
import { makeError } from "@/lib/errors";
import { timingSafeEqual, createHmac } from "crypto";

/**
 * Generic webhook receiver for payment-provider events.
 * Per blueprint FR-PAY-001: signed, timestamped, replay-protected, idempotent.
 *
 * Expected headers:
 *   X-Rillio-Signature: hex HMAC-SHA256 of `${timestamp}.${rawBody}` using WEBHOOK_SECRET
 *   X-Rillio-Timestamp: unix seconds
 *   X-Rillio-Event-Id: unique event id (idempotency key)
 *
 * Body shape (provider-agnostic):
 *   { type: "payment.settled" | "payment.failed" | "subscription.cancelled",
 *     userId, planCode, provider, signature, amountMinor, currency, intentId? }
 */
function verifySignature(raw: string, timestamp: string, signature: string, secret: string): boolean {
  if (!timestamp || !signature || !secret) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  // 5-minute replay window
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;
  // Use HMAC via crypto
  const { createHmac } = require("crypto");
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  try { return timingSafeEqual(a, b); } catch { return false; }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.WEBHOOK_SECRET || "";
  const sig = req.headers.get("x-rillio-signature") || "";
  const ts = req.headers.get("x-rillio-timestamp") || "";
  const eventId = req.headers.get("x-rillio-event-id") || "";

  if (!verifySignature(raw, ts, sig, secret)) {
    return NextResponse.json(makeError("WEBHOOK_SIGNATURE_INVALID", "Invalid signature", "Webhook signature verification failed.", 401), { status: 401 });
  }

  let body: unknown;
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json(makeError("VALIDATION_ERROR", "Invalid JSON", "Body must be JSON.", 422), { status: 422 });
  }

  // Idempotency: event id must be unique
  if (eventId) {
    const exists = await db.auditEvent.findFirst({ where: { action: "webhook_received", resourceId: eventId } });
    if (exists) {
      return NextResponse.json({ ok: true, idempotent: true });
    }
  }

  const b = (body && typeof body === "object") ? (body as Record<string, unknown>) : {};
  await db.auditEvent.create({
    data: {
      userId: typeof b.userId === "string" ? b.userId : null,
      actor: "webhook",
      action: "webhook_received",
      resourceType: "webhook",
      resourceId: eventId || null,
      metadata: JSON.stringify(body),
    },
  });

  // Dispatch by type
  if (b.type === "payment.settled" && typeof b.userId === "string" && typeof b.planCode === "string" && typeof b.signature === "string") {
    try {
      const res = await settleSubscription({
        userId: b.userId as string,
        planCode: b.planCode as string,
        provider: b.provider === "sol" ? "sol" : "usdc",
        signature: b.signature as string,
        amountMinor: String(b.amountMinor ?? "0"),
        currency: typeof b.currency === "string" ? b.currency : "USDC",
        intentId: typeof b.intentId === "string" ? b.intentId : undefined,
      });
      return NextResponse.json({ ok: true, idempotent: res.idempotent });
    } catch (e) {
      return NextResponse.json(makeError("INTERNAL_ERROR", "Settlement failed", String(e), 500), { status: 500 });
    }
  }

  if (b.type === "subscription.cancelled" && typeof b.userId === "string") {
    await db.subscription.updateMany({
      where: { userId: b.userId as string, status: "active" },
      data: { status: "canceled", canceledAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: true });
}
