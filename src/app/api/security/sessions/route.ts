/**
 * GET  /api/security/sessions — active + recently-revoked sessions for the
 *      signed-in user, with a `current` flag for the calling device.
 * POST /api/security/sessions — { action: "revoke-others" } kills every
 *      other active session (stolen-cookie response).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentUser, hashToken } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";

const SESSION_COOKIE = "rillio_session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to view sessions.", 401), { status: 401 });
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const currentHash = token ? hashToken(token) : null;

  const sessions = await db.session.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const now = new Date();
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      deviceInfo: s.deviceInfo ?? "Unknown device",
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      revokedAt: s.revokedAt?.toISOString() ?? null,
      expired: s.expiresAt < now,
      current: currentHash === s.tokenHash,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to manage sessions.", 401), { status: 401 });
  }
  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(makeError("VALIDATION_ERROR", "Invalid JSON", "Request body is not valid JSON.", 400), { status: 400 });
  }

  if (body.action !== "revoke-others") {
    return NextResponse.json(makeError("VALIDATION_ERROR", "Unknown action", "Supported action: revoke-others.", 422, {
      fieldErrors: [{ field: "action", code: "invalid_value", message: "Must be 'revoke-others'." }],
    }), { status: 422 });
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const currentHash = token ? hashToken(token) : null;
  const active = await db.session.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } } });
  const others = active.filter((s) => s.tokenHash !== currentHash);

  for (const s of others) {
    await db.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
  }
  await recordAudit({
    userId: user.id,
    actor: "user",
    action: "auth.sessions_revoked_others",
    resourceType: "Session",
    resourceId: null,
    metadata: { revokedCount: others.length },
  });

  return NextResponse.json({ revoked: others.length, keptCurrent: true });
}
