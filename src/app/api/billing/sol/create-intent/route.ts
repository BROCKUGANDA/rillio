import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { seedPlans } from "@/lib/billing/entitlements";
import { createSolIntent } from "@/lib/billing/sol";

const schema = z.object({ planCode: z.enum(["plus"]) });

/**
 * POST /api/billing/sol/create-intent
 * Creates a native SOL payment intent (Solana Pay reference standard).
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
  if (!plan || !plan.solRecipient) {
    return NextResponse.json(
      makeError("SOL_NOT_CONFIGURED", "SOL checkout not configured", "Set SOL_RECIPIENT_WALLET in the environment to enable native SOL checkout.", 409),
      { status: 409 }
    );
  }

  const result = await createSolIntent({
    userId: user.id,
    planCode: plan.code,
    usdCents: Number(plan.priceMinor),
    recipient: plan.solRecipient,
  });

  if ("error" in result) {
    return NextResponse.json(makeError(result.code, "SOL quote unavailable", result.error, 503, { retryable: true }), { status: 503 });
  }

  return NextResponse.json({
    intentId: result.intentId,
    reference: result.reference,
    recipient: result.recipient,
    lamports: result.lamports,
    solAmount: result.solAmount,
    quotedSolPrice: result.quotedSolPrice,
    pricingMode: result.pricingMode,
    expiry: result.expiry.toISOString(),
    solanaPayUrl: result.solanaPayUrl,
    instructions: [
      `Send exactly ${result.solAmount} SOL to ${result.recipient}.`,
      "Easiest path: open the Solana Pay link in your wallet — it fills recipient, amount and reference for you.",
      "Or send a transfer with the reference included as a memo / reference key.",
      "Send from a self-custody wallet you control. Rillio never sees your private keys.",
    ],
    note: result.pricingMode === "oracle"
      ? `Quoted at the live oracle price of $${result.quotedSolPrice.toFixed(2)}/SOL. Stored with the intent for audit. The server verifies the exact lamports, recipient and reference onchain before granting entitlement.`
      : `Quoted at the operator-fixed rate of $${result.quotedSolPrice.toFixed(2)}/SOL (live price sources unreachable). Recorded transparently in the intent for audit. The server verifies the exact lamports, recipient and reference onchain before granting entitlement.`,
  });
}
