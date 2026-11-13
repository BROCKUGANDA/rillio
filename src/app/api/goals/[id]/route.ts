import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const { id } = await params;
  const goal = await db.goal.findFirst({
    where: { id, userId: user.id },
    include: { events: { orderBy: { createdAt: "desc" } } },
  });
  if (!goal) {
    return NextResponse.json(makeError("NOT_FOUND", "Goal not found", "This goal does not exist.", 404), { status: 404 });
  }
  return NextResponse.json({
    goal: {
      ...goal,
      targetMinor: goal.targetMinor.toString(),
      startingAmountMinor: goal.startingAmountMinor.toString(),
      plannedContributionMinor: goal.plannedContributionMinor.toString(),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.name === "string") update.name = body.name.slice(0, 80);
  if (typeof body.targetMinor === "string" && /^\d+$/.test(body.targetMinor)) update.targetMinor = BigInt(body.targetMinor);
  if (typeof body.plannedContributionMinor === "string" && /^\d+$/.test(body.plannedContributionMinor)) update.plannedContributionMinor = BigInt(body.plannedContributionMinor);
  if (typeof body.contributionCadence === "string" && ["weekly", "biweekly", "monthly"].includes(body.contributionCadence)) update.contributionCadence = body.contributionCadence;
  if (typeof body.targetDate === "string") update.targetDate = new Date(body.targetDate);
  if (body.targetDate === null) update.targetDate = null;
  if (typeof body.notes === "string") update.notes = body.notes.slice(0, 2000);

  const goal = await db.goal.findFirst({ where: { id, userId: user.id } });
  if (!goal) {
    return NextResponse.json(makeError("NOT_FOUND", "Goal not found", "This goal does not exist.", 404), { status: 404 });
  }
  const updated = await db.goal.update({ where: { id }, data: update });
  await db.goalEvent.create({
    data: {
      goalId: id,
      type: "updated",
      actor: "user",
      metadata: JSON.stringify(update),
    },
  });
  return NextResponse.json({
    goal: {
      ...updated,
      targetMinor: updated.targetMinor.toString(),
      startingAmountMinor: updated.startingAmountMinor.toString(),
      plannedContributionMinor: updated.plannedContributionMinor.toString(),
    },
  });
}

export async function DELETE(
  _req: NextRequest,
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
  await db.goal.update({ where: { id }, data: { status: "archived" } });
  await db.goalEvent.create({
    data: { goalId: id, type: "archived", actor: "user" },
  });
  return NextResponse.json({ ok: true });
}
