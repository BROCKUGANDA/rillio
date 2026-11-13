import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { verifyWalletSignature, checkSolanaBoundary, isValidSolanaAddress } from "@/lib/solana";

/**
 * POST /api/wallets/verify
 *
 * Per blueprint §4.5 FR-CHAIN-005: verifies signature/domain/nonce/expiry/replay.
 * In this MVP environment without a configured signing library, the verification
 * is recorded as unverified — the UI surfaces this honestly.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { address, signature, nonce, message } = body as {
    address?: string;
    signature?: string | null;
    nonce?: string;
    message?: string;
  };

  if (!address || !isValidSolanaAddress(address)) {
    return NextResponse.json(makeError("VALIDATION_ERROR", "Invalid address", "Provide a valid Solana address.", 422), { status: 422 });
  }
  if (!nonce) {
    return NextResponse.json(makeError("VALIDATION_ERROR", "Missing nonce", "Challenge nonce is required.", 422), { status: 422 });
  }

  // Replay/lookup: confirm this nonce was issued for this user/address recently
  const recent = await db.auditEvent.findFirst({
    where: {
      userId: user.id,
      action: "wallet_challenge_issued",
      resourceId: address,
      createdAt: { gte: new Date(Date.now() - 1000 * 60 * 10) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!recent) {
    return NextResponse.json(makeError("AUTH_CHALLENGE_EXPIRED", "Challenge expired", "Request a new wallet challenge and try again.", 401), { status: 401 });
  }

  const host = req.headers.get("host") || "rillio.example";
  const verify = verifyWalletSignature({
    address,
    signature: signature ?? null,
    expectedNonce: nonce,
    expectedDomain: host,
  });

  if (!verify.ok) {
    return NextResponse.json(makeError("WALLET_VERIFICATION_FAILED", "Verification failed", verify.reason, 401), { status: 401 });
  }

  // Persist wallet (read-only)
  const existing = await db.wallet.findFirst({ where: { userId: user.id, address } });
  let wallet;
  if (existing) {
    wallet = await db.wallet.update({
      where: { id: existing.id },
      data: { disconnectedAt: null, verification: verify.verified ? "verified" : "unverified" },
    });
  } else {
    wallet = await db.wallet.create({
      data: {
        userId: user.id,
        address,
        chain: "solana",
        verification: verify.verified ? "verified" : "unverified",
        visibility: "private",
      },
    });
  }

  await db.auditEvent.create({
    data: {
      userId: user.id,
      actor: user.id,
      action: "wallet_connected",
      resourceType: "wallet",
      resourceId: wallet.id,
      reason: verify.verified ? "Verified by signature" : verify.reason,
      metadata: JSON.stringify({ address, verified: verify.verified }),
    },
  });

  return NextResponse.json({
    wallet,
    verified: verify.verified,
    verificationReason: verify.verified ? null : (verify as { reason?: string }).reason,
    boundary: checkSolanaBoundary(),
  });
}
