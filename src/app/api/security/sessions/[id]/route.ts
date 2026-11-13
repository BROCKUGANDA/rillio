/**
 * DELETE /api/security/sessions/[id] — revoke one session by id. Revoking
 * the current session signs that device out on its next request.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to manage sessions.", 401), { status: 401 });
  }
  const { id } = await params;

  const session = await db.session.findFirst({ where: { id, userId: user.id } });
  if (!session) {
    return NextResponse.json(makeError("NOT_FOUND", "Not found", "No such session for this account.", 404), { status: 404 });
  }
  if (session.revokedAt) {
    return NextResponse.json({ ok: true, alreadyRevoked: true });
  }

  await db.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  await recordAudit({
    userId: user.id,
    actor: "user",
    action: "auth.session_revoked",
    resourceType: "Session",
    resourceId: session.id,
    metadata: { device: session.deviceInfo },
  });

  return NextResponse.json({ ok: true });
}
