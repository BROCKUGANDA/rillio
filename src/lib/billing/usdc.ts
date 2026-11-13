/**
 * USDC checkout — Solana-based stablecoin payment verification.
 *
 * Per blueprint §4.8 FR-PAY-002:
 *   USDC checkout only after server checks signature, exact amount, mint,
 *   recipient, reference and confirmation/finality; replay/wrong token rejected.
 *
 * Flow:
 *   1. POST /api/billing/usdc/create-intent → creates a PaymentIntent with
 *      a unique reference, expected amount, recipient wallet, mint, and expiry.
 *   2. User submits a USDC SPL transfer from their wallet to the recipient,
 *      using the reference as memo.
 *   3. POST /api/billing/usdc/verify-payment → server queries the recipient's
 *      recent incoming transfers via Solana RPC, verifies:
 *        - signature exists and is confirmed/finalized
 *        - exact mint matches
 *        - exact amount matches
 *        - recipient matches
 *        - reference is present in the transfer's memo or instruction data
 *      If all checks pass, marks the payment settled + grants entitlement.
 */

import { db } from "@/lib/db";
import { checkSolanaBoundary } from "@/lib/solana";
import { getConfirmedTransaction, getSignatureStatus } from "@/lib/solana-rpc";

// Solana mainnet USDC mint
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
// USDC has 6 decimals

export type UsdcIntent = {
  id: string;
  reference: string;
  recipient: string;
  mint: string;
  amountMinor: bigint; // in USDC base units (6 decimals)
  currency: string;
  expiry: Date;
  status: string;
};

export type UsdcVerificationResult =
  | { ok: true; signature: string; finalized: boolean; verified: true }
  | { ok: false; reason: string; code: string };

/**
 * Verify a USDC payment by signature against the expected intent.
 *
 * Server checks (all must pass):
 *   1. Intent is not expired
 *   2. Intent is not already settled (replay protection)
 *   3. Signature exists and is confirmed/finalized onchain
 *   4. The transaction's token transfers include:
 *      - exact mint match
 *      - exact amount match
 *      - recipient match
 *   5. Reference appears in the transfer (memo or instruction data)
 */
export async function verifyUsdcPayment(opts: {
  intentId: string;
  signature: string;
}): Promise<UsdcVerificationResult> {
  const intent = await db.paymentIntent.findUnique({ where: { id: opts.intentId } });
  if (!intent) {
    return { ok: false, reason: "Payment intent not found.", code: "INTENT_NOT_FOUND" };
  }
  if (intent.status === "confirmed") {
    return { ok: false, reason: "Intent already settled.", code: "ALREADY_SETTLED" };
  }
  if (intent.expiry < new Date()) {
    await db.paymentIntent.update({ where: { id: intent.id }, data: { status: "expired" } });
    return { ok: false, reason: "Intent has expired.", code: "INTENT_EXPIRED" };
  }
  const boundary = checkSolanaBoundary();
  if (boundary.kind === "not_configured") {
    return {
      ok: false,
      reason: "Solana RPC not configured. Cannot verify onchain payment.",
      code: "RPC_NOT_CONFIGURED",
    };
  }

  // 1. Signature status — must be at least confirmed
  const status = await getSignatureStatus(opts.signature);
  if (!status.found) {
    return { ok: false, reason: "Signature not found onchain.", code: "SIGNATURE_NOT_FOUND" };
  }
  if (status.error) {
    return { ok: false, reason: `Transaction failed: ${status.error}`, code: "TX_FAILED" };
  }
  if (!status.confirmed) {
    return { ok: false, reason: "Transaction not yet confirmed.", code: "TX_NOT_CONFIRMED" };
  }

  // 2. Fetch the transaction and verify token transfer details
  const tx = await getConfirmedTransaction(opts.signature);
  if (!tx.found) {
    return { ok: false, reason: "Transaction not retrievable.", code: "TX_NOT_RETRIEVABLE" };
  }

  // Check postTokenBalances for the recipient
  if (!tx.meta?.postTokenBalances || !tx.meta?.preTokenBalances) {
    return { ok: false, reason: "No token balance changes in transaction.", code: "NO_TOKEN_CHANGES" };
  }
  if (!tx.message) {
    return { ok: false, reason: "Transaction message missing.", code: "TX_MESSAGE_MISSING" };
  }

  // Find the recipient's account index
  const recipient = intent.recipient;
  const recipientIndex = tx.message.accountKeys.indexOf(recipient);
  if (recipientIndex < 0) {
    return { ok: false, reason: `Recipient ${recipient} not in transaction account keys.`, code: "RECIPIENT_MISSING" };
  }

  // Find token balance change for the recipient on the expected mint
  const preBal = tx.meta.preTokenBalances.find(
    (b) => b.accountIndex === recipientIndex && b.mint === intent.mint
  );
  const postBal = tx.meta.postTokenBalances.find(
    (b) => b.accountIndex === recipientIndex && b.mint === intent.mint
  );
  const preAmount = preBal ? BigInt(preBal.uiTokenAmount.amount) : 0n;
  const postAmount = postBal ? BigInt(postBal.uiTokenAmount.amount) : 0n;
  const delta = postAmount - preAmount;

  if (delta <= 0n) {
    return { ok: false, reason: "No incoming USDC transfer to recipient.", code: "NO_INCOMING_TRANSFER" };
  }
  if (delta !== intent.amountMinor) {
    return {
      ok: false,
      reason: `Amount mismatch. Expected ${intent.amountMinor} base units, received ${delta}.`,
      code: "AMOUNT_MISMATCH",
    };
  }

  // Mint check (already done above by filter, but double-check)
  if (postBal?.mint !== intent.mint) {
    return { ok: false, reason: "Mint mismatch.", code: "MINT_MISMATCH" };
  }

  // Reference check — search instruction data for the reference
  const reference = intent.reference;
  let referenceFound = false;
  for (const instr of tx.message.instructions) {
    try {
      const data = Buffer.from(instr.data, "base64");
      if (data.includes(Buffer.from(reference))) {
        referenceFound = true;
        break;
      }
    } catch {
      // ignore
    }
  }
  // Reference may also be in account keys (as a reference key)
  if (!referenceFound) {
    if (tx.message.accountKeys.includes(reference)) {
      referenceFound = true;
    }
  }
  if (!referenceFound) {
    return {
      ok: false,
      reason: "Reference not found in transaction data or account keys.",
      code: "REFERENCE_MISSING",
    };
  }

  // All checks pass — settle
  await db.$transaction([
    db.paymentSettlement.create({
      data: {
        userId: intent.userId,
        intentId: intent.id,
        signature: opts.signature,
        verifiedAmountMinor: delta,
        verifiedMint: intent.mint,
        verifiedRecipient: intent.recipient,
        finality: status.finalized ? "finalized" : "confirmed",
      },
    }),
    db.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "confirmed", confirmedAt: new Date() },
    }),
  ]);

  return {
    ok: true,
    signature: opts.signature,
    finalized: status.finalized,
    verified: true,
  };
}

/**
 * After a USDC payment is verified, settle subscription via shared settle.ts.
 */
export async function settleUsdcSubscription(opts: { intentId: string; signature: string }) {
  const intent = await db.paymentIntent.findUnique({ where: { id: opts.intentId } });
  if (!intent) throw new Error("Intent not found");
  const plan = await db.plan.findFirst({ where: { code: "plus" } });
  if (!plan) throw new Error("Plus plan not found");
  const { settleSubscription } = await import("./settle");
  const res = await settleSubscription({
    userId: intent.userId,
    planCode: plan.code,
    provider: "usdc",
    signature: opts.signature,
    amountMinor: intent.amountMinor.toString(),
    currency: "USDC",
    intentId: intent.id,
  });
  return res.subscription;
}
