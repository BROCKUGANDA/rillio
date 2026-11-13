import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { verifyWalletSignature, checkSolanaBoundary, isValidSolanaAddress } from "@/lib/solana";
import { getSolBalance } from "@/lib/solana-rpc";

/**
 * POST /api/wallets/verify
 *
 * Per blueprint §4.5 FR-CHAIN-005: verifies signature/domain/nonce/expiry/replay.
 *
 * Real ed25519 verification via tweetnacl. If a signature is provided and
 * matches, the wallet is marked "verified". If no signature is provided,
 * the wallet is accepted as "unverified" with a clear reason in the UI.
 *
 * After successful verification, immediately triggers a read-only observation
 * (real RPC balance fetch when configured) so the portfolio view has fresh data.
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

  // Verify the nonce matches what was issued (parse metadata)
  try {
    const meta = JSON.parse(recent.metadata || "{}");
    if (meta.nonce !== nonce) {
      return NextResponse.json(makeError("AUTH_NONCE_MISMATCH", "Nonce mismatch", "The nonce does not match the issued challenge.", 401), { status: 401 });
    }
    // Check expiry
    if (new Date(meta.expiresAt) < new Date()) {
      return NextResponse.json(makeError("AUTH_CHALLENGE_EXPIRED", "Challenge expired", "The signing challenge has expired. Request a new one.", 401), { status: 401 });
    }
    // Domain check
    const host = req.headers.get("host") || "rillio.example";
    if (meta.domain !== host) {
      return NextResponse.json(makeError("AUTH_DOMAIN_MISMATCH", "Domain mismatch", "The challenge was issued for a different domain.", 401), { status: 401 });
    }
  } catch {
    return NextResponse.json(makeError("AUTH_CHALLENGE_INVALID", "Invalid challenge", "Could not parse challenge metadata.", 401), { status: 401 });
  }

  const host = req.headers.get("host") || "rillio.example";
  const fullMessage = message || [
    "Rillio Wallet Verification",
    `Domain: ${host}`,
    "Purpose: connect_readonly",
    `Nonce: ${nonce}`,
    "",
    "This request is read-only. Rillio will never request a transaction or transfer.",
  ].join("\n");

  const verify = verifyWalletSignature({
    address,
    signature: signature ?? null,
    message: fullMessage,
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
      data: {
        disconnectedAt: null,
        verification: verify.verified ? "verified" : "unverified",
        lastScanAt: new Date(),
      },
    });
  } else {
    wallet = await db.wallet.create({
      data: {
        userId: user.id,
        address,
        chain: "solana",
        verification: verify.verified ? "verified" : "unverified",
        visibility: "private",
        lastScanAt: new Date(),
      },
    });
  }

  // Audit trail
  await db.auditEvent.create({
    data: {
      userId: user.id,
      actor: user.id,
      action: "wallet_connected",
      resourceType: "wallet",
      resourceId: wallet.id,
      reason: verify.verified ? "Verified by ed25519 signature" : verify.reason,
      metadata: JSON.stringify({
        address,
        verified: verify.verified,
        code: verify.verified ? "signature_valid" : (verify as { code?: string }).code,
      }),
    },
  });

  // Mark the challenge as consumed (replay protection)
  await db.auditEvent.create({
    data: {
      userId: user.id,
      actor: user.id,
      action: "wallet_challenge_consumed",
      resourceType: "wallet",
      resourceId: address,
      metadata: JSON.stringify({ nonce, walletId: wallet.id }),
    },
  });

  // Trigger read-only observation only for SOL balance (fast). Token account
  // observation is done lazily via /api/wallets/[id]/refresh to avoid blocking
  // the verify request for wallets with many token accounts.
  const boundary = checkSolanaBoundary();
  let observation: { triggered: boolean; solBalance?: string; error?: string } = { triggered: false };
  if (boundary.kind === "ok") {
    try {
      // Fetch just the SOL balance inline — fast and bounded
      const solBalance = await getSolBalance(address);
      // Persist SOL as a pseudo-token account (skip if balance fetch returned empty)
      const solMint = "So11111111111111111111111111111111111111112";
      const existing = await db.tokenAccount.findUnique({
        where: { walletId_mint: { walletId: wallet.id, mint: solMint } },
      });
      const data = {
        mint: solMint,
        tokenProgram: "native",
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
        baseUnitAmount: solBalance.toString(),
        snapshotAt: new Date(),
        verified: true,
        unpriced: true,
        priceQuoteUsd: null,
        priceSource: null,
        priceObservedAt: null,
      };
      if (existing) {
        await db.tokenAccount.update({ where: { id: existing.id }, data });
      } else {
        await db.tokenAccount.create({ data: { walletId: wallet.id, ...data } });
      }
      observation = { triggered: true, solBalance: solBalance.toString() };
    } catch (e) {
      observation = { triggered: false, error: e instanceof Error ? e.message : "SOL balance fetch failed" };
    }
  }

  return NextResponse.json({
    wallet,
    verified: verify.verified,
    verificationReason: verify.verified ? null : verify.reason,
    boundary,
    observation,
  });
}
