/**
 * Entitlement reconciliation.
 *
 * Per blueprint §4.8 FR-PAY-001:
 *   - Entitlements reconciled server-side transactionally
 *   - Browser redirect never grants access — only verified webhook does
 *   - Duplicate webhook gives one transition (idempotent)
 *
 * Entitlements are feature flags tied to the user's active subscription.
 * The Free plan has defaults; Plus adds higher limits and features.
 */

import { db } from "@/lib/db";

export type EntitlementFeature =
  | "csv_import_limit"
  | "multi_account"
  | "multi_currency"
  | "recurring_detection"
  | "custom_rules"
  | "multiple_goals"
  | "scenario_planning"
  | "portfolio_analytics"
  | "exports"
  | "notifications_configurable";

export const PLAN_FEATURES: Record<string, Partial<Record<EntitlementFeature, string>>> = {
  free: {
    csv_import_limit: "1000",
    multi_account: "false",
    multi_currency: "false",
    recurring_detection: "false",
    custom_rules: "false",
    multiple_goals: "3",
    scenario_planning: "false",
    portfolio_analytics: "false",
    exports: "false",
    notifications_configurable: "false",
  },
  plus: {
    csv_import_limit: "100000",
    multi_account: "true",
    multi_currency: "true",
    recurring_detection: "true",
    custom_rules: "true",
    multiple_goals: "50",
    scenario_planning: "true",
    portfolio_analytics: "true",
    exports: "true",
    notifications_configurable: "true",
  },
};

/**
 * Seed the default plans if they don't exist.
 */
export async function seedPlans() {
  const existing = await db.plan.count();
  if (existing > 0) return;
  await db.plan.createMany({
    data: [
      {
        code: "free",
        name: "Free",
        description: "One workspace, basic insights, read-only wallet.",
        priceMinor: 0n,
        currency: "USD",
        interval: "month",
        featuresJson: JSON.stringify(PLAN_FEATURES.free),
        isActive: true,
      },
      {
        code: "plus",
        name: "Rillio Plus",
        description: "Higher limits, multi-account, recurring detection, custom rules, scenarios, exports.",
        priceMinor: 800n, // $8.00/month in cents
        currency: "USD",
        interval: "month",
        featuresJson: JSON.stringify(PLAN_FEATURES.plus),
        isActive: true,
        stripePriceId: process.env.STRIPE_PLUS_PRICE_ID || null,
        usdcRecipient: process.env.USDC_RECIPIENT_WALLET || null,
      },
    ],
  });
}

/**
 * Sync entitlements for a user based on their active subscription.
 * Idempotent: calling twice produces the same result.
 */
export async function syncEntitlements(userId: string, subscriptionId: string | null, planCode: string): Promise<void> {
  const features = PLAN_FEATURES[planCode] ?? PLAN_FEATURES.free;
  for (const [feature, value] of Object.entries(features)) {
    if (value === undefined) continue;
    await db.entitlement.upsert({
      where: { userId_feature: { userId, feature } },
      create: {
        userId,
        feature,
        value,
        source: subscriptionId ? "subscription" : "plan_default",
        subscriptionId: subscriptionId ?? null,
      },
      update: {
        value,
        source: subscriptionId ? "subscription" : "plan_default",
        subscriptionId: subscriptionId ?? null,
        effectiveFrom: new Date(),
        effectiveUntil: null,
      },
    });
  }
}

/**
 * Get the effective entitlement for a user. Falls back to free plan defaults.
 */
export async function getEntitlements(userId: string): Promise<Record<string, string>> {
  const rows = await db.entitlement.findMany({
    where: {
      userId,
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
    },
  });
  const result: Record<string, string> = {};
  for (const r of rows) {
    result[r.feature] = r.value;
  }
  // Defaults if nothing set
  if (Object.keys(result).length === 0) {
    return { ...PLAN_FEATURES.free } as Record<string, string>;
  }
  return result;
}

/**
 * Get the user's active subscription, if any.
 */
export async function getActiveSubscription(userId: string) {
  const sub = await db.subscription.findFirst({
    where: {
      userId,
      status: { in: ["active", "trialing"] },
      OR: [{ canceledAt: null }, { canceledAt: { gt: new Date() } }],
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
  return sub;
}
