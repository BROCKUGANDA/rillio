import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { getActiveSubscription } from "@/lib/billing/entitlements";
import { cancelSubscription } from "@/lib/billing/stripe";

/**
 * GET /api/billing/subscription
 * Returns the user's current subscription + invoices.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const sub = await getActiveSubscription(user.id);
  if (!sub) {
    return NextResponse.json({ subscription: null, invoices: [], plan: null });
  }
  const invoices = await db.invoice.findMany({
    where: { subscriptionId: sub.id },
    orderBy: { createdAt: "desc" },
    take: 24,
  });
  return NextResponse.json({
    subscription: {
      ...sub,
      plan: { ...sub.plan, priceMinor: sub.plan.priceMinor.toString() },
    },
    invoices: invoices.map((i) => ({
      ...i,
      amountMinor: i.amountMinor.toString(),
    })),
  });
}

/**
 * POST /api/billing/subscription/cancel (also handled at /api/billing/cancel)
 *
 * Cancels the subscription at period end. Calls Stripe to cancel.
 * The actual entitlement removal happens via the webhook when the
 * subscription actually ends — this request only schedules cancellation.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const sub = await getActiveSubscription(user.id);
  if (!sub) {
    return NextResponse.json(makeError("NO_SUBSCRIPTION", "No subscription", "You don't have an active subscription.", 404), { status: 404 });
  }
  if (sub.provider === "stripe" && sub.externalId) {
    const result = await cancelSubscription(sub.externalId);
    if ("error" in result) {
      return NextResponse.json(makeError("STRIPE_CANCEL_FAILED", "Cancellation failed", result.error, 502), { status: 502 });
    }
    await db.subscription.update({
      where: { id: sub.id },
      data: {
        cancelAt: result.cancel_at ? new Date(result.cancel_at * 1000) : null,
        status: result.status,
      },
    });
    await db.auditEvent.create({
      data: {
        userId: user.id,
        actor: user.id,
        action: "subscription_cancel_scheduled",
        resourceType: "subscription",
        resourceId: sub.id,
        reason: "User-initiated cancellation",
        metadata: JSON.stringify({ cancelAt: result.cancel_at }),
      },
    });
    return NextResponse.json({
      ok: true,
      cancelAt: result.cancel_at ? new Date(result.cancel_at * 1000).toISOString() : null,
      note: "Subscription will cancel at period end. Entitlements remain active until then.",
    });
  }
  // USDC or other — cancel immediately
  await db.subscription.update({
    where: { id: sub.id },
    data: { status: "canceled", canceledAt: new Date() },
  });
  return NextResponse.json({ ok: true, note: "Subscription canceled." });
}
