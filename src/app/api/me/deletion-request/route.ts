import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { revokeAllSessions } from "@/lib/auth";

/**
 * POST /api/me/deletion-request
 *
 * Per blueprint §4.9 FR-PRIV-002: protected deletion request with documented
 * legal retention handling. In MVP we mark the user deletion_pending and
 * revoke sessions — actual hard delete happens after a grace period.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const existing = await db.deletionRequest.findFirst({
    where: { userId: user.id, status: { in: ["requested", "processing"] } },
  });
  if (existing) {
    return NextResponse.json({
      request: existing,
      message: "A deletion request is already in progress.",
    });
  }
  const request = await db.deletionRequest.create({
    data: { userId: user.id, status: "requested", reason: "User-initiated deletion" },
  });
  await db.user.update({
    where: { id: user.id },
    data: { status: "deletion_pending" },
  });
  await db.auditEvent.create({
    data: {
      userId: user.id,
      actor: user.id,
      action: "deletion_requested",
      resourceType: "user",
      resourceId: user.id,
    },
  });
  // Revoke all sessions immediately
  await revokeAllSessions(user.id);
  return NextResponse.json({
    request,
    message:
      "Your account is scheduled for deletion. You will be signed out. Contact support within 30 days to cancel.",
  });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const requests = await db.deletionRequest.findMany({
    where: { userId: user.id },
    orderBy: { requestedAt: "desc" },
    take: 10,
  });
  return NextResponse.json({ requests });
}
