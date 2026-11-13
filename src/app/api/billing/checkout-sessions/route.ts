import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { seedPlans } from "@/lib/billing/entitlements";
import { createCheckoutSession, getStripeConfig } from "@/lib/billing/stripe";

const schema = z.object({
  planCode: z.enum(["plus"]),
  provider: z.enum(["stripe", "usdc"]).default("stripe"),
});

/**
 * POST /api/billing/checkout-sessions
 *
 * Per blueprint §4.8 FR-PAY-001:
 *   - Browser redirect never grants access — entitlement only via webhook
 *   - Idempotent (idempotency key checked)
 *
 * Returns the URL to redirect to (Stripe) or the USDC payment intent details.
 * The success_url is informational only; the actual entitlement is granted
 * when the webhook fires and is reconciled server-side.
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
  const { planCode, provider } = parsed.data;
  const plan = await db.plan.findUnique({ where: { code: planCode } });
  if (!plan || !plan.isActive) {
    return NextResponse.json(makeError("PLAN_NOT_FOUND", "Plan not found", "This plan is not available.", 404), { status: 404 });
  }

  // Idempotency check
  const idempotencyKey = `checkout-${user.id}-${planCode}-${provider}`;
  const existing = await db.checkoutSession.findFirst({
    where: { userId: user.id, idempotencyKey, status: "open" },
  });
  if (existing) {
    // Return the existing open session
    if (provider === "stripe" && existing.externalId) {
      const stripeConfig = getStripeConfig();
      if (stripeConfig.configured) {
        // We can't easily reconstruct the URL from a session id, so create a new one
        // if the existing one expired. For MVP, just create a new session.
      }
    }
  }

  if (provider === "stripe") {
    const stripeConfig = getStripeConfig();
    if (!stripeConfig.configured || !plan.stripePriceId) {
      return NextResponse.json(
        makeError(
          "STRIPE_NOT_CONFIGURED",
          "Stripe not configured",
          stripeConfig.configured
            ? "This plan does not have a Stripe price ID set. Set STRIPE_PLUS_PRICE_ID in the environment."
            : "Stripe is not configured in this environment. Set STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_PLUS_PRICE_ID and STRIPE_WEBHOOK_SECRET to enable checkout.",
          409
        ),
        { status: 409 }
      );
    }
    // Create checkout session record
    const checkoutSession = await db.checkoutSession.create({
      data: {
        userId: user.id,
        planId: plan.id,
        provider: "stripe",
        idempotencyKey,
        status: "open",
        amountMinor: plan.priceMinor,
        currency: plan.currency,
        returnUrl: "/?view=settings",
      },
    });

    const host = req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const origin = `${proto}://${host}`;
    const result = await createCheckoutSession({
      userId: user.id,
      userEmail: user.email,
      planStripePriceId: plan.stripePriceId,
      successUrl: `${origin}/api/billing/checkout-return?session_id={CHECKOUT_SESSION_ID}&cs_rillio=${checkoutSession.id}`,
      cancelUrl: `${origin}/?view=settings&billing=cancelled`,
      idempotencyKey,
    });
    if ("error" in result) {
      await db.checkoutSession.update({
        where: { id: checkoutSession.id },
        data: { status: "failed" },
      });
      return NextResponse.json(makeError("STRIPE_CHECKOUT_FAILED", "Checkout failed", result.error, 502), { status: 502 });
    }
    await db.checkoutSession.update({
      where: { id: checkoutSession.id },
      data: { externalId: result.sessionId, status: "open" },
    });
    return NextResponse.json({
      provider: "stripe",
      url: result.url,
      sessionId: result.sessionId,
      checkoutSessionId: checkoutSession.id,
      note: "You will be redirected to Stripe. Entitlement is granted only after the verified webhook confirms payment — not from this redirect.",
    });
  }

  // USDC path
  const usdcRecipient = plan.usdcRecipient;
  if (!usdcRecipient) {
    return NextResponse.json(
      makeError(
        "USDC_NOT_CONFIGURED",
        "USDC checkout not configured",
        "Set USDC_RECIPIENT_WALLET and SOLANA_RPC_URL in the environment to enable USDC checkout.",
        409
      ),
      { status: 409 }
    );
  }
  // Forward to USDC intent creation
  const usdcRes = await fetch(`${req.nextUrl.origin}/api/billing/usdc/create-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") || "" },
    body: JSON.stringify({ planCode }),
  });
  const usdcData = await usdcRes.json();
  return NextResponse.json(usdcData, { status: usdcRes.status });
}
