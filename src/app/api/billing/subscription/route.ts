import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { getActiveSubscription } from "@/lib/billing/entitlements";

/**
 * GET /api/billing/subscription — current subscription + invoices.
 * POST /api/billing/subscription — cancel at period end (onchain subs).
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
    invoices: invoices.map((i) => ({ ...i, amountMinor: i.amountMinor.toString() })),
  });
}

/**
 * Cancel at period end. For onchain subscriptions (usdc/sol) we mark
 * cancel_at period end equivalent by setting cancelAt/canceledAt and
 * allowing entitlements to lapse at currentPeriodEnd.
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
  const periodEnd = sub.currentPeriodEnd ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await db.subscription.update({
    where: { id: sub.id },
    data: { cancelAt: periodEnd, status: "active" },
  });
  await db.auditEvent.create({
    data: {
      userId: user.id,
      actor: user.id,
      action: "subscription_cancel_scheduled",
      resourceType: "subscription",
      resourceId: sub.id,
      reason: "User-initiated cancellation",
      metadata: JSON.stringify({ cancelAt: periodEnd.toISOString() }),
    },
  });
  return NextResponse.json({
    ok: true,
    cancelAt: periodEnd.toISOString(),
    note: "Subscription will end at period close. Entitlements remain active until then.",
  });
}
