import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { seedPlans } from "@/lib/billing/entitlements";

const schema = z.object({
  planCode: z.enum(["plus"]),
  provider: z.enum(["usdc", "sol"]).default("usdc"),
});

/**
 * POST /api/billing/checkout-sessions
 *
 * Solana-only checkout. Delegates to USDC or native-SOL intent creation.
 * Returns payment details the user acts on in their own wallet — Rillio
 * never takes custody, never sees keys, and grants entitlement only after
 * onchain verification (see /api/billing/{usdc,sol}/verify-payment).
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

  const idempotencyKey = `checkout-${user.id}-${planCode}-${provider}-${Math.floor(Date.now() / 60000)}`;
  const existing = await db.checkoutSession.findFirst({
    where: { userId: user.id, idempotencyKey, status: "open" },
  });

  const origin = `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("host") || "localhost:3000"}`;

  // Delegate to provider-specific intent creation
  const target = provider === "usdc" ? "/api/billing/usdc/create-intent" : "/api/billing/sol/create-intent";
  const res = await fetch(`${origin}${target}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") || "" },
    body: JSON.stringify({ planCode }),
  });
  const data = await res.json();

  // Record the checkout session for ops/reconciliation
  if (res.ok) {
    await db.checkoutSession.create({
      data: {
        userId: user.id,
        planId: plan.id,
        provider,
        externalId: data.intentId ?? null,
        idempotencyKey,
        status: "open",
        amountMinor: provider === "usdc" ? plan.priceMinor : BigInt(data.lamports ?? "0"),
        currency: provider === "usdc" ? "USDC" : "SOL",
        returnUrl: "/?view=billing",
      },
    });
    if (existing) {
      await db.checkoutSession.update({ where: { id: existing.id }, data: { status: "expired" } });
    }
  }

  return NextResponse.json(data, { status: res.status });
}
