import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { getActiveSubscription, getEntitlements } from "@/lib/billing/entitlements";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  // Get latest import + counts for quick UI bootstrap
  const [importCount, transactionCount, goalCount, walletCount, sub, entitlements] = await Promise.all([
    db.importJob.count({ where: { userId: user.id } }),
    db.transaction.count({ where: { userId: user.id } }),
    db.goal.count({ where: { userId: user.id, status: { in: ["active", "paused"] } } }),
    db.wallet.count({ where: { userId: user.id, disconnectedAt: null } }),
    getActiveSubscription(user.id),
    getEntitlements(user.id),
  ]);

  return NextResponse.json({
    user,
    counts: {
      imports: importCount,
      transactions: transactionCount,
      goals: goalCount,
      wallets: walletCount,
    },
    plan: {
      code: sub ? sub.plan.code : "free",
      name: sub ? sub.plan.name : "Free",
      status: sub ? sub.status : "active",
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    },
    entitlements,
  });
}
