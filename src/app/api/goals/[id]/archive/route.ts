import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";

export async function POST(
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
  const updated = await db.goal.update({ where: { id }, data: { status: "archived" } });
  await db.goalEvent.create({ data: { goalId: id, type: "archived", actor: "user" } });
  return NextResponse.json({
    goal: {
      ...updated,
      targetMinor: updated.targetMinor.toString(),
      startingAmountMinor: updated.startingAmountMinor.toString(),
      plannedContributionMinor: updated.plannedContributionMinor.toString(),
    },
  });
}
