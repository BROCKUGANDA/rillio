import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { projectGoal, type Cadence } from "@/lib/goals";

/**
 * POST /api/goals/[id]/simulate
 *
 * Deterministic projection. NO guaranteed return (blueprint §4.4 FR-GOAL-002).
 * If the user provides an assumedReturnRate, the response labels it as a
 * "non-guaranteed illustrative scenario" with the assumption stated.
 *
 * The math lives in lib/goals.ts so it is unit-tested and has one definition.
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
    assumedReturnRate, // annualised, e.g. 0.04 = 4%
  } = body as {
    plannedContributionMinor?: string;
    contributionCadence?: Cadence;
    targetDate?: string;
    assumedReturnRate?: number;
  };

  // Validate the caller-supplied contribution rather than trusting BigInt().
  let contribution = goal.plannedContributionMinor;
  if (plannedContributionMinor !== undefined) {
    if (!/^\d+$/.test(plannedContributionMinor)) {
      return NextResponse.json(
        makeError("GOAL_TARGET_INVALID", "Invalid contribution", "Contribution must be a non-negative integer amount in minor units.", 422, {
          fieldErrors: [{ field: "plannedContributionMinor", code: "INVALID", message: "Use a non-negative integer." }],
        }),
        { status: 422 },
      );
    }
    contribution = BigInt(plannedContributionMinor);
  }

  let parsedTargetDate: Date | null = goal.targetDate;
  if (targetDate !== undefined) {
    const d = new Date(targetDate);
    if (isNaN(d.getTime())) {
      return NextResponse.json(
        makeError("GOAL_TARGET_INVALID", "Invalid target date", "Provide a valid ISO date.", 422, {
          fieldErrors: [{ field: "targetDate", code: "INVALID", message: "Use an ISO 8601 date." }],
        }),
        { status: 422 },
      );
    }
    parsedTargetDate = d;
  }

  const projection = projectGoal({
    startingAmountMinor: goal.startingAmountMinor,
    plannedContributionMinor: contribution,
    cadence: (contributionCadence ?? goal.contributionCadence) as Cadence,
    targetMinor: goal.targetMinor,
    targetDate: parsedTargetDate,
    assumedReturnRate,
  });

  return NextResponse.json({
    goalId: goal.id,
    months: projection.months,
    schedule: projection.schedule.slice(-12),
    targetMinor: projection.targetMinor,
    startingAmountMinor: projection.startingAmountMinor,
    projectedAmountMinor: projection.projectedAmountMinor,
    reachesTarget: projection.reachesTarget,
    shortfallMinor: projection.shortfallMinor,
    assumedReturnRate: projection.assumedReturnRate,
    warning: projection.warning,
    disclaimer: projection.disclaimer,
  });
}
