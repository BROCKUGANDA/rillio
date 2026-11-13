import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";

/**
 * POST /api/goals/[id]/simulate
 *
 * Deterministic projection. NO guaranteed return (blueprint §4.4 FR-GOAL-002).
 * If the user provides an assumedReturnRate, the response labels it as
 * "non-guaranteed illustrative scenario" with the assumption stated.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const { id } = await params;
  const goal = await db.goal.findFirst({ where: { id, userId: user.id } });
  if (!goal) {
    return NextResponse.json(makeError("NOT_FOUND", "Goal not found", "This goal does not exist.", 404), { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    plannedContributionMinor,
    contributionCadence,
    targetDate,
    assumedReturnRate, // annualized, e.g. 0.04 = 4%
  } = body as {
    plannedContributionMinor?: string;
    contributionCadence?: "weekly" | "biweekly" | "monthly";
    targetDate?: string;
    assumedReturnRate?: number;
  };

  const contribution = plannedContributionMinor
    ? BigInt(plannedContributionMinor)
    : goal.plannedContributionMinor;
  const cadence = contributionCadence ?? goal.contributionCadence;
  const target = targetDate ? new Date(targetDate) : goal.targetDate;
  const starting = goal.startingAmountMinor;

  // Project forward from today to target date, deterministic.
  const now = new Date();
  const end = target ?? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  const monthsTotal =
    (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  const months = Math.max(0, monthsTotal);

  // Cadence -> contributions per month
  const perMonth = cadence === "weekly" ? contribution * 4n : cadence === "biweekly" ? contribution * 2n : contribution;

  // No assumed return by default
  let projected = starting;
  const schedule: { month: number; contribution: string; projected: string; label: string }[] = [];
  const useAssumedReturn = typeof assumedReturnRate === "number" && assumedReturnRate > 0 && assumedReturnRate < 0.5;

  for (let m = 0; m <= months; m++) {
    if (m > 0) {
      // Apply contribution
      projected += perMonth;
      // Apply assumed return (illustrative, non-guaranteed) — simple monthly compounding
      if (useAssumedReturn) {
        // projected = projected * (1 + r/12)
        // Use scaled integer math: projected * (1200 + r*12) / 1200
        const monthlyBps = Math.round(assumedReturnRate * 1200 / 12);
        projected = (projected * BigInt(1200 + monthlyBps)) / 1200n;
      }
    }
    schedule.push({
      month: m,
      contribution: perMonth.toString(),
      projected: projected.toString(),
      label: new Date(now.getFullYear(), now.getMonth() + m, 1).toISOString().slice(0, 7),
    });
  }

  const reachesTarget = projected >= goal.targetMinor;
  const shortfallMinor = reachesTarget ? 0n : goal.targetMinor - projected;

  return NextResponse.json({
    goalId: goal.id,
    targetMinor: goal.targetMinor.toString(),
    startingAmountMinor: starting.toString(),
    projectedAmountMinor: projected.toString(),
    reachesTarget,
    shortfallMinor: shortfallMinor.toString(),
    months,
    schedule: schedule.slice(-12),
    assumedReturnRate: useAssumedReturn ? assumedReturnRate : null,
    warning:
      useAssumedReturn
        ? "Illustrative scenario with assumed return. Not guaranteed. Past performance does not predict future results."
        : "Projection assumes no investment return. Actual outcomes depend on where funds are held.",
    disclaimer: "Planned allocations are not held funds. Rillio does not custody money in MVP.",
  });
}
