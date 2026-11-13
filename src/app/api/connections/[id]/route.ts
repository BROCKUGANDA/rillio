import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";

/**
 * DELETE /api/connections/[id]
 *
 * Revokes the connection and consent. Stops future syncs.
 * Per blueprint §4.9 FR-PRIV-001: revoke stops future provider access and starts cleanup.
 * Retained transactions stay (per data retention policy) but no new syncs occur.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const { id } = await params;
  const connection = await db.financialConnection.findFirst({
    where: { id, userId: user.id },
  });
  if (!connection) {
    return NextResponse.json(makeError("NOT_FOUND", "Connection not found", "This connection does not exist.", 404), { status: 404 });
  }

  // Revoke connection
  await db.financialConnection.update({
    where: { id: connection.id },
    data: {
      status: "revoked",
      revokedAt: new Date(),
    },
  });

  // Revoke associated consent
  await db.consent.updateMany({
    where: {
      userId: user.id,
      provider: connection.provider,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  // Audit
  await db.auditEvent.create({
    data: {
      userId: user.id,
      actor: user.id,
      action: "connection_revoked",
      resourceType: "financial_connection",
      resourceId: connection.id,
      reason: "User-initiated revocation",
    },
  });

  // Notify
  await db.notification.create({
    data: {
      userId: user.id,
      type: "connection_revoked",
      title: "Connection revoked",
      body: `Your ${connection.provider} connection has been revoked. No new syncs will occur. Existing transactions are retained per policy.`,
      payload: JSON.stringify({ connectionId: connection.id }),
    },
  });

  return NextResponse.json({ ok: true });
}
