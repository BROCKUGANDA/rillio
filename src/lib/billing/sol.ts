/**
 * Native SOL checkout — Solana Pay-style transfer verification.
 *
 * Per blueprint §4.8 FR-PAY-002 and the Solana payments quickstart:
 *   - PaymentIntent carries a unique reference (Solana Pay uses a 32-byte
 *     public key as a reference encoded in the transfer URL)
 *   - Server verifies: signature exists, transaction confirmed/finalized,
 *     exact lamports delivered to the recipient, reference present in
 *     account keys (Solana Pay reference key) or memo instruction
 *   - Replay protected via unique settlement signature
 *
 * SOL amount is quoted at intent creation from the price source; the quoted
 * price is stored in intent metadata for audit. If no price source is
 * available, SOL checkout is honestly unavailable (never a fabricated rate).
 */

import { db } from "@/lib/db";
import { checkSolanaBoundary } from "@/lib/solana";
import { getConfirmedTransaction, getSignatureStatus } from "@/lib/solana-rpc";
import { settleSubscription } from "./settle";
import base58 from "bs58";

const LAMPORTS_PER_SOL = 1_000_000_000n;

export type SolIntent = {
  id: string;
  reference: string; // base58 32-byte key (Solana Pay reference)
  recipient: string;
  lamports: string;
  solAmount: string;
  quotedSolPrice: number;
  expiry: Date;
  status: string;
};

export type SolVerificationResult =
  | { ok: true; signature: string; finalized: boolean }
  | { ok: false; reason: string; code: string };

/** Fetch SOL/USD price using the same multi-source chain as portfolio pricing.
 *  Falls back to an explicit operator-fixed rate (SOL_PRICE_USD env var) when
 *  live sources are unreachable — recorded transparently as pricingMode
 *  "operator_fixed" in the intent, never presented as an oracle quote. */
export type SolPriceQuote = { price: number; mode: "oracle" | "operator_fixed" };

async function fetchSolUsdPrice(): Promise<SolPriceQuote | null> {
  // 1. Jupiter price API
  try {
    const res = await fetch("https://price.jup.ag/v6/price?ids=SOL", { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = (await res.json()) as { data?: Record<string, { price: number }> };
      const p = data.data?.SOL?.price;
      if (typeof p === "number" && p > 0) return { price: p, mode: "oracle" };
    }
  } catch { /* next source */ }
  // 2. Pyth Hermes SOL/USD feed
  try {
    const res = await fetch(
      "https://hermes.pyth.network/v2/updates/price/latest?ids[]=0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
      { signal: AbortSignal.timeout(3000) }
    );
    if (res.ok) {
      const data = (await res.json()) as { binary?: { parsed?: Array<{ price: { price: string; expo: number } }> } };
      const parsed = data.binary?.parsed?.[0]?.price;
      if (parsed) {
        const usd = Number(parsed.price) * Math.pow(10, parsed.expo);
        if (usd > 0) return { price: usd, mode: "oracle" };
      }
    }
  } catch { /* next source */ }
  // 3. Operator-fixed rate (transparent, auditable — the merchant's chosen rate)
  const fixed = Number(process.env.SOL_PRICE_USD || 0);
  if (fixed > 0) return { price: fixed, mode: "operator_fixed" };
  return null;
}

/** Generate a Solana Pay reference: fresh 32-byte key, base58 encoded. */
function generateReference(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return base58.encode(bytes);
}

/** Build a Solana Pay transfer URL (deep link) for wallets to fill. */
export function buildSolanaPayUrl(opts: {
  recipient: string;
  solAmount: string;
  reference: string;
  label: string;
  message: string;
}): string {
  const params = new URLSearchParams({
    amount: opts.solAmount,
    reference: opts.reference,
    label: opts.label,
    message: opts.message,
  });
  return `solana:${opts.recipient}?${params.toString()}`;
}

/**
 * Create a SOL payment intent for a plan (usdCents → lamports at quoted price).
 */
export async function createSolIntent(opts: {
  userId: string;
  planCode: string;
  usdCents: number;
  recipient: string;
}): Promise<{ intentId: string; reference: string; recipient: string; lamports: string; solAmount: string; quotedSolPrice: number; pricingMode: "oracle" | "operator_fixed"; expiry: Date; solanaPayUrl: string } | { error: string; code: string }> {
  const quote = await fetchSolUsdPrice();
  if (!quote) {
    return {
      error: "SOL/USD price is unavailable and no operator-fixed rate is configured (set SOL_PRICE_USD). Rillio will not quote a payment at a made-up rate. Try again shortly, or pay with USDC (stablecoin, exact $8).",
      code: "SOL_PRICE_UNAVAILABLE",
    };
  }
  const price = quote.price;
  const solAmount = opts.usdCents / 100 / price;
  const lamports = BigInt(Math.round(solAmount * Number(LAMPORTS_PER_SOL)));
  const reference = generateReference();
  const expiry = new Date(Date.now() + 1000 * 60 * 30);

  const intent = await db.paymentIntent.create({
    data: {
      userId: opts.userId,
      reference,
      recipient: opts.recipient,
      mint: null, // native SOL — no mint
      amountMinor: lamports,
      currency: "SOL",
      expiry,
      status: "pending",
      metadata: JSON.stringify({
        planCode: opts.planCode,
        quotedSolPrice: price,
        pricingMode: quote.mode,
        usdCents: opts.usdCents,
        protocol: "solana-pay",
      }),
    },
  });

  const solAmountStr = (Number(lamports) / Number(LAMPORTS_PER_SOL)).toFixed(9);
  const solanaPayUrl = buildSolanaPayUrl({
    recipient: opts.recipient,
    solAmount: solAmountStr,
    reference,
    label: "Rillio Plus",
    message: `Rillio Plus subscription ${reference}`,
  });

  await db.auditEvent.create({
    data: {
      userId: opts.userId,
      actor: opts.userId,
      action: "sol_intent_created",
      resourceType: "payment_intent",
      resourceId: intent.id,
      metadata: JSON.stringify({ reference, lamports: lamports.toString(), quotedSolPrice: price }),
    },
  });

  return {
    intentId: intent.id,
    reference,
    recipient: opts.recipient,
    lamports: lamports.toString(),
    solAmount: solAmountStr,
    quotedSolPrice: price,
    pricingMode: quote.mode,
    expiry,
    solanaPayUrl,
  };
}

/**
 * Verify a native SOL transfer.
 *
 * Native SOL moves via account balance deltas, so we check
 * meta.preBalances/postBalances rather than token balances.
 */
export async function verifySolPayment(opts: { intentId: string; signature: string }): Promise<SolVerificationResult> {
  const intent = await db.paymentIntent.findUnique({ where: { id: opts.intentId } });
  if (!intent) return { ok: false, reason: "Payment intent not found.", code: "INTENT_NOT_FOUND" };
  if (intent.status === "confirmed") return { ok: false, reason: "Intent already settled.", code: "ALREADY_SETTLED" };
  if (intent.expiry < new Date()) {
    await db.paymentIntent.update({ where: { id: intent.id }, data: { status: "expired" } });
    return { ok: false, reason: "Intent has expired.", code: "INTENT_EXPIRED" };
  }
  const boundary = checkSolanaBoundary();
  if (boundary.kind === "not_configured") {
    return { ok: false, reason: "Solana RPC not configured. Cannot verify onchain payment.", code: "RPC_NOT_CONFIGURED" };
  }

  const status = await getSignatureStatus(opts.signature);
  if (!status.found) return { ok: false, reason: "Signature not found onchain.", code: "SIGNATURE_NOT_FOUND" };
  if (status.error) return { ok: false, reason: `Transaction failed: ${status.error}`, code: "TX_FAILED" };
  if (!status.confirmed) return { ok: false, reason: "Transaction not yet confirmed.", code: "TX_NOT_CONFIRMED" };

  const tx = await getConfirmedTransaction(opts.signature);
  if (!tx.found || !tx.meta || !tx.message) {
    return { ok: false, reason: "Transaction not retrievable.", code: "TX_NOT_RETRIEVABLE" };
  }

  // Recipient balance delta (native SOL)
  const recipientIndex = tx.message.accountKeys.indexOf(intent.recipient);
  if (recipientIndex < 0) {
    return { ok: false, reason: `Recipient ${intent.recipient} not in transaction account keys.`, code: "RECIPIENT_MISSING" };
  }
  const pre = BigInt(tx.meta.preBalances?.[recipientIndex] ?? 0);
  const post = BigInt(tx.meta.postBalances?.[recipientIndex] ?? 0);
  const delta = post - pre;
  const expected = intent.amountMinor; // lamports

  if (delta <= 0n) {
    return { ok: false, reason: "No native SOL delivered to the recipient.", code: "NO_INCOMING_TRANSFER" };
  }
  if (delta < expected) {
    return {
      ok: false,
      reason: `Amount mismatch. Expected ${expected} lamports, received ${delta}.`,
      code: "AMOUNT_MISMATCH",
    };
  }
  // Overpayment tolerated (price drift between quote and send) — but never underpayment.

  // Reference check: Solana Pay reference keys appear in account keys; memo fallback
  let referenceFound = tx.message.accountKeys.includes(intent.reference);
  if (!referenceFound) {
    for (const instr of tx.message.instructions) {
      try {
        const data = Buffer.from(instr.data, "base64");
        if (data.includes(Buffer.from(intent.reference))) { referenceFound = true; break; }
        // SPL Memo program stores memo as raw UTF-8
        const utf8 = data.toString("utf8");
        if (utf8.includes(intent.reference)) { referenceFound = true; break; }
      } catch { /* ignore */ }
    }
  }
  if (!referenceFound) {
    return { ok: false, reason: "Reference not found in account keys or memo. Include the Solana Pay reference when sending.", code: "REFERENCE_MISSING" };
  }

  await db.$transaction([
    db.paymentSettlement.create({
      data: {
        userId: intent.userId,
        intentId: intent.id,
        signature: opts.signature,
        verifiedAmountMinor: delta,
        verifiedMint: null,
        verifiedRecipient: intent.recipient,
        finality: status.finalized ? "finalized" : "confirmed",
      },
    }),
    db.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "confirmed", confirmedAt: new Date() },
    }),
  ]);

  return { ok: true, signature: opts.signature, finalized: status.finalized };
}

/** Settle subscription after a verified SOL transfer. */
export async function settleSolSubscription(opts: { intentId: string; signature: string }) {
  const intent = await db.paymentIntent.findUnique({ where: { id: opts.intentId } });
  if (!intent) throw new Error("Intent not found");
  const plan = await db.plan.findFirst({ where: { code: "plus" } });
  if (!plan) throw new Error("Plus plan not found");
  const res = await settleSubscription({
    userId: intent.userId,
    planCode: plan.code,
    provider: "sol",
    signature: opts.signature,
    amountMinor: intent.amountMinor.toString(),
    currency: "SOL",
    intentId: intent.id,
  });
  return res.subscription;
}
