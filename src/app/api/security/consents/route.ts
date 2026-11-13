/**
 * GET   /api/security/consents — dated, versioned consent ledger.
 * PATCH /api/security/consents — { consentId, action: "revoke" } records
 *         explicit withdrawal. Consent rows are never deleted — withdrawal
 *         is a state change (revokedAt) so the history stays auditable.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to view consents.", 401), { status: 401 });
  }
  const consents = await db.consent.findMany({
    where: { userId: user.id },
    orderBy: { grantedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    consents: consents.map((c) => ({
      id: c.id,
      provider: c.provider,
      scope: c.scope,
      policyVersion: c.policyVersion,
      grantedAt: c.grantedAt.toISOString(),
      revokedAt: c.revokedAt?.toISOString() ?? null,
      active: c.revokedAt === null,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to manage consents.", 401), { status: 401 });
  }
  let body: { consentId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(makeError("VALIDATION_ERROR", "Invalid JSON", "Request body is not valid JSON.", 400), { status: 400 });
  }
  if (body.action !== "revoke" || !body.consentId) {
    return NextResponse.json(makeError("VALIDATION_ERROR", "Invalid request", "Provide consentId and action='revoke'.", 422), { status: 422 });
  }

  const consent = await db.consent.findFirst({ where: { id: body.consentId, userId: user.id } });
  if (!consent) {
    return NextResponse.json(makeError("NOT_FOUND", "Not found", "No such consent for this account.", 404), { status: 404 });
  }
  if (consent.revokedAt) {
    return NextResponse.json({ ok: true, alreadyRevoked: true });
  }

  const updated = await db.consent.update({ where: { id: consent.id }, data: { revokedAt: new Date() } });
  await recordAudit({
    userId: user.id,
    actor: "user",
    action: "consent.revoked",
    resourceType: "Consent",
    resourceId: consent.id,
    metadata: { provider: consent.provider, scope: consent.scope },
  });

  return NextResponse.json({
    ok: true,
    consent: { id: updated.id, provider: updated.provider, scope: updated.scope, revokedAt: updated.revokedAt?.toISOString() ?? null },
  });
}
