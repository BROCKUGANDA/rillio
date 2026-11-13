import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { seedPlans, getEntitlements, getActiveSubscription } from "@/lib/billing/entitlements";

/**
 * GET /api/billing/plans
 * Returns available plans + the user's current subscription + entitlements.
 * Solana-only payments (USDC + native SOL).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  await seedPlans();
  const [plans, subscription, entitlements] = await Promise.all([
    db.plan.findMany({ where: { isActive: true }, orderBy: { priceMinor: "asc" } }),
    getActiveSubscription(user.id),
    getEntitlements(user.id),
  ]);
  return NextResponse.json({
    plans: plans.map((p) => ({
      ...p,
      priceMinor: p.priceMinor.toString(),
      features: JSON.parse(p.featuresJson),
    })),
    subscription: subscription
      ? {
          ...subscription,
          plan: { ...subscription.plan, priceMinor: subscription.plan.priceMinor.toString() },
        }
      : null,
    entitlements,
    payments: {
      protocol: "solana-pay",
      providers: ["usdc", "sol"],
      usdcConfigured: plans.find((p) => p.code === "plus")?.usdcRecipient != null,
      solConfigured: plans.find((p) => p.code === "plus")?.solRecipient != null,
      note: "Onchain payments only. Entitlement is granted solely after server-side verification of the transfer (exact amount, recipient, reference, finality).",
    },
  });
}
