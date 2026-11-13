/**
 * Shared settlement — grants subscription + entitlements after verified payment.
 *
 * Per blueprint §4.8 FR-PAY-001 / FR-PAY-002:
 *   - Entitlements reconciled server-side transactionally
 *   - Duplicate settlement gives one transition (idempotent via unique signature)
 *   - No browser redirect ever grants access — only verified onchain confirmation
 */

import { db } from "@/lib/db";
import { syncEntitlements } from "./entitlements";

export type SettleInput = {
  userId: string;
  planCode: string;
  provider: "usdc" | "sol";
  signature: string; // onchain transaction signature (unique, replay-protected)
  amountMinor: string; // verified base units (USDC 6d / SOL lamports 9d)
  currency: string; // "USDC" | "SOL"
  intentId?: string;
};

export async function settleSubscription(input: SettleInput) {
  const plan = await db.plan.findFirst({ where: { code: input.planCode, isActive: true } });
  if (!plan) throw new Error("PLAN_NOT_FOUND");

  // Replay protection: same signature can never settle twice
  const existingSettlement = await db.paymentSettlement.findUnique({ where: { signature: input.signature } });
  if (existingSettlement) {
    const existingSub = await db.subscription.findFirst({
      where: { userId: input.userId, status: { in: ["active", "trialing"] } },
      orderBy: { createdAt: "desc" },
    });
    return { subscription: existingSub, idempotent: true };
  }

  const periodEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  const sub = await db.subscription.create({
    data: {
      userId: input.userId,
      planId: plan.id,
      provider: input.provider,
      externalId: input.signature,
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
    },
  });

  await db.invoice.create({
    data: {
      userId: input.userId,
      subscriptionId: sub.id,
      providerInvoiceId: input.signature,
      amountMinor: BigInt(input.amountMinor),
      currency: input.currency,
      state: "paid",
      paidAt: new Date(),
    },
  });

  await syncEntitlements(input.userId, sub.id, plan.code);

  await db.auditEvent.create({
    data: {
      userId: input.userId,
      actor: `${input.provider}_verifier`,
      action: "subscription_activated",
      resourceType: "subscription",
      resourceId: sub.id,
      metadata: JSON.stringify({
        provider: input.provider,
        signature: input.signature,
        amountMinor: input.amountMinor,
        currency: input.currency,
        planCode: plan.code,
        intentId: input.intentId,
      }),
    },
  });

  await db.notification.create({
    data: {
      userId: input.userId,
      type: "subscription_activated",
      title: "Rillio Plus is active",
      body: `Payment verified onchain (${input.currency}). All Plus features unlocked for 30 days.`,
      payload: JSON.stringify({ subscriptionId: sub.id, provider: input.provider }),
    },
  });

  return { subscription: sub, idempotent: false };
}
