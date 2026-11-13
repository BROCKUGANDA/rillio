import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { createWalletChallenge, checkSolanaBoundary, isValidSolanaAddress } from "@/lib/solana";

/**
 * POST /api/wallets/challenge
 * Returns a short-lived, domain-bound message for the user's wallet to sign.
 * Per blueprint §4.5 FR-CHAIN-005: hashed nonce, replay/wrong-domain/expired rejected.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const address = (body.address ?? "").trim();
  if (!isValidSolanaAddress(address)) {
    return NextResponse.json(
      makeError("VALIDATION_ERROR", "Invalid address", "Provide a valid Solana address.", 422, {
        fieldErrors: [{ field: "address", code: "INVALID", message: "Enter a valid Solana wallet address." }],
      }),
      { status: 422 }
    );
  }

  const host = req.headers.get("host") || "rillio.example";
  const challenge = createWalletChallenge({
    domain: host,
    purpose: "connect_readonly",
  });

  // Persist challenge (hashed) so /verify can check nonce + expiry
  await db.auditEvent.create({
    data: {
      userId: user.id,
      actor: user.id,
      action: "wallet_challenge_issued",
      resourceType: "wallet",
      resourceId: address,
      reason: "Read-only wallet connection",
      metadata: JSON.stringify({
        nonce: challenge.nonce,
        domain: host,
        expiresAt: challenge.expiresAt.toISOString(),
      }),
    },
  });

  return NextResponse.json({
    address,
    message: challenge.message,
    nonce: challenge.nonce,
    expiresAt: challenge.expiresAt,
    boundary: checkSolanaBoundary(),
  });
}
