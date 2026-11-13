import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { getProvider, encryptCredential } from "@/lib/providers/registry";

const connectSchema = z.object({
  providerCode: z.string().min(1),
  consentScope: z.string().default("transactions:read"),
  // For real providers: oauth code or access token. For demo: ignored.
  authPayload: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/connections
 *
 * Creates a new bank-statement provider connection behind an explicit consent.
 * Per blueprint §4.9 FR-PRIV-001: dated/versioned granular consent; revoke stops future access.
 *
 * 1. Validate consent scope
 * 2. Persist consent record (dated, versioned)
 * 3. Exchange auth payload for a provider credential (encrypted)
 * 4. Persist FinancialConnection + ProviderCredential
 * 5. Initial account list is fetched lazily on first sync
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      makeError("VALIDATION_ERROR", "Validation failed", "Please correct the highlighted fields.", 422, {
        fieldErrors: parsed.error.issues.map((i) => ({ field: i.path.join("."), code: i.code, message: i.message })),
      }),
      { status: 422 }
    );
  }
  const { providerCode, consentScope } = parsed.data;
  const provider = getProvider(providerCode);
  if (!provider) {
    return NextResponse.json(makeError("PROVIDER_NOT_FOUND", "Unknown provider", `Provider "${providerCode}" is not registered.`, 404), { status: 404 });
  }
  if (!provider.info.isAvailable) {
    return NextResponse.json(
      makeError("PROVIDER_UNAVAILABLE", "Provider unavailable", provider.info.availabilityNote ?? "This provider is not available in this environment.", 409),
      { status: 409 }
    );
  }

  // Record consent first (blueprint FR-PRIV-001)
  const consent = await db.consent.create({
    data: {
      userId: user.id,
      provider: providerCode,
      scope: consentScope,
      policyVersion: "v1",
      grantedAt: new Date(),
    },
  });

  // Build a credential. For demo, it's just a synthetic token. For real
  // providers, this would call provider.exchangeAuthCode(authPayload).
  const credentialPlaintext = providerCode === "demo"
    ? `demo-token-${user.id}-${Date.now()}`
    : (parsed.data.authPayload?.access_token as string) || "pending";

  const encrypted = encryptCredential(credentialPlaintext);

  // Create connection
  const connection = await db.financialConnection.create({
    data: {
      userId: user.id,
      provider: providerCode,
      status: "active",
      syncCount: 0,
    },
  });

  // Persist encrypted credential
  await db.providerCredential.create({
    data: {
      userId: user.id,
      connectionId: connection.id,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      algorithm: encrypted.algorithm,
    },
  });

  // Audit
  await db.auditEvent.create({
    data: {
      userId: user.id,
      actor: user.id,
      action: "connection_created",
      resourceType: "financial_connection",
      resourceId: connection.id,
      reason: `Consent granted: ${consentScope}`,
      metadata: JSON.stringify({ provider: providerCode, consentId: consent.id, isDemo: provider.info.isDemo }),
    },
  });

  // Notify
  await db.notification.create({
    data: {
      userId: user.id,
      type: "connection_created",
      title: `${provider.info.name} connected`,
      body: provider.info.isDemo
        ? "Demo provider connected. Sync to import synthetic test transactions."
        : "Bank connection established. Sync to import transactions.",
      payload: JSON.stringify({ connectionId: connection.id }),
    },
  });

  return NextResponse.json({
    connection,
    consent: { id: consent.id, scope: consent.scope, grantedAt: consent.grantedAt },
    provider: provider.info,
  });
}

/**
 * GET /api/connections — list user's connections
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const connections = await db.financialConnection.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { credential: true },
  });
  // Also fetch active consents
  const consents = await db.consent.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { grantedAt: "desc" },
  });
  return NextResponse.json({
    connections: connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      status: c.status,
      lastSyncAt: c.lastSyncAt,
      lastSyncStatus: c.lastSyncStatus,
      lastSyncError: c.lastSyncError,
      syncCount: c.syncCount,
      accountsJson: c.accountsJson,
      revokedAt: c.revokedAt,
      createdAt: c.createdAt,
    })),
    consents: consents.map((c) => ({
      id: c.id,
      provider: c.provider,
      scope: c.scope,
      policyVersion: c.policyVersion,
      grantedAt: c.grantedAt,
    })),
  });
}
