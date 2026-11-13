import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  targetMinor: z.string().regex(/^\d+$/),
  currency: z.string().length(3),
  startingAmountMinor: z.string().regex(/^\d+$/).default("0"),
  plannedContributionMinor: z.string().regex(/^\d+$/).default("0"),
  contributionCadence: z.enum(["weekly", "biweekly", "monthly"]).default("monthly"),
  targetDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const goals = await db.goal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { events: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  return NextResponse.json({
    goals: goals.map((g) => ({
      ...g,
      targetMinor: g.targetMinor.toString(),
      startingAmountMinor: g.startingAmountMinor.toString(),
      plannedContributionMinor: g.plannedContributionMinor.toString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      makeError("VALIDATION_ERROR", "Validation failed", "Please correct the highlighted fields.", 422, {
        fieldErrors: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          code: i.code,
          message: i.message,
        })),
      }),
      { status: 422 }
    );
  }
  const data = parsed.data;
  const goal = await db.goal.create({
    data: {
      userId: user.id,
      name: data.name,
      targetMinor: BigInt(data.targetMinor),
      currency: data.currency,
      startingAmountMinor: BigInt(data.startingAmountMinor),
      plannedContributionMinor: BigInt(data.plannedContributionMinor),
      contributionCadence: data.contributionCadence,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      status: "active",
      notes: data.notes,
    },
  });
  await db.goalEvent.create({
    data: {
      goalId: goal.id,
      type: "created",
      actor: "user",
      metadata: JSON.stringify({ targetMinor: data.targetMinor, plannedContributionMinor: data.plannedContributionMinor }),
    },
  });
  return NextResponse.json({
    goal: {
      ...goal,
      targetMinor: goal.targetMinor.toString(),
      startingAmountMinor: goal.startingAmountMinor.toString(),
      plannedContributionMinor: goal.plannedContributionMinor.toString(),
    },
  });
}
