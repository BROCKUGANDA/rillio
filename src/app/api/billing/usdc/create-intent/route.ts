import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { seedPlans } from "@/lib/billing/entitlements";
import { USDC_MINT } from "@/lib/billing/usdc";
import { randomBytes } from "crypto";

const schema = z.object({
  planCode: z.enum(["plus"]),
});

/**
 * POST /api/billing/usdc/create-intent
 *
 * Creates a USDC payment intent with:
 *   - unique reference (used as memo/reference key in the SPL transfer)
 *   - exact expected amount in USDC base units (6 decimals)
 *   - recipient wallet (USDC_RECIPIENT_WALLET env var)
 *   - mint (USDC mainnet mint)
 *   - 30-minute expiry
 *
 * The user must then submit a USDC transfer from their wallet to the recipient,
 * including the reference as a memo or reference key in the transfer.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      makeError("VALIDATION_ERROR", "Validation failed", "Please correct the highlighted fields.", 422, {
        fieldErrors: parsed.error.issues.map((i) => ({ field: i.path.join("."), code: i.code, message: i.message })),
      }),
      { status: 422 }
    );
  }
  await seedPlans();
  const plan = await db.plan.findUnique({ where: { code: parsed.data.planCode } });
  if (!plan || !plan.usdcRecipient) {
    return NextResponse.json(
      makeError(
        "USDC_NOT_CONFIGURED",
        "USDC checkout not configured",
        "Set USDC_RECIPIENT_WALLET in the environment to enable USDC checkout.",
        409
      ),
      { status: 409 }
    );
  }

  // Convert plan price (in USD cents) to USDC base units (6 decimals)
  // $8.00 = 800 cents = 8_000_000 USDC base units
  const usdcAmountMinor = plan.priceMinor * 10000n; // cents → 6-decimal base units

  const reference = randomBytes(16).toString("hex");
  const expiry = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes

  const intent = await db.paymentIntent.create({
    data: {
      userId: user.id,
      reference,
      recipient: plan.usdcRecipient,
      mint: USDC_MINT,
      amountMinor: usdcAmountMinor,
      currency: "USDC",
      expiry,
      status: "pending",
      metadata: JSON.stringify({ planCode: plan.code, planId: plan.id }),
    },
  });

  await db.auditEvent.create({
    data: {
      userId: user.id,
      actor: user.id,
      action: "usdc_intent_created",
      resourceType: "payment_intent",
      resourceId: intent.id,
      metadata: JSON.stringify({ reference, amount: usdcAmountMinor.toString(), mint: USDC_MINT }),
    },
  });

  return NextResponse.json({
    intentId: intent.id,
    reference,
    recipient: plan.usdcRecipient,
    mint: USDC_MINT,
    amountBaseUnits: usdcAmountMinor.toString(),
    amountDisplay: (Number(usdcAmountMinor) / 1e6).toFixed(2),
    currency: "USDC",
    expiry: expiry.toISOString(),
    instructions: [
      `Send exactly ${(Number(usdcAmountMinor) / 1e6).toFixed(2)} USDC to ${plan.usdcRecipient}.`,
      "Include the reference in the transfer memo or as a reference key.",
      "Do not send from an exchange — use a wallet that lets you add a memo.",
      "Rillio will verify the signature, exact amount, mint, recipient and reference onchain before granting entitlement.",
    ],
    note: "Rillio never sees your private keys. Verification reads the Solana ledger read-only.",
  });
}
