import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { verifySolPayment, settleSolSubscription } from "@/lib/billing/sol";

const schema = z.object({
  intentId: z.string().min(1),
  signature: z.string().min(64),
});

/**
 * POST /api/billing/sol/verify-payment
 * Verifies a native SOL transfer onchain, then settles the subscription.
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
  const intent = await db.paymentIntent.findUnique({ where: { id: parsed.data.intentId } });
  if (!intent || intent.userId !== user.id) {
    return NextResponse.json(makeError("INTENT_NOT_FOUND", "Intent not found", "This payment intent does not exist.", 404), { status: 404 });
  }

  const result = await verifySolPayment({ intentId: parsed.data.intentId, signature: parsed.data.signature });
  if (!result.ok) {
    return NextResponse.json(
      makeError("SOL_VERIFICATION_FAILED", "Verification failed", result.reason, 422, { retryable: result.code === "TX_NOT_CONFIRMED" }),
      { status: 422 }
    );
  }

  const sub = await settleSolSubscription({ intentId: parsed.data.intentId, signature: parsed.data.signature });
  return NextResponse.json({
    verified: true,
    finalized: result.finalized,
    signature: result.signature,
    subscriptionId: sub?.id ?? null,
    note: result.finalized
      ? "Payment finalized onchain. Rillio Plus is active."
      : "Payment confirmed. Entitlement granted; finalization pending. Do not send another payment.",
  });
}
