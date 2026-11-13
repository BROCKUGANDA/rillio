import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { verifyStripeWebhook, retrieveCheckoutSession } from "@/lib/billing/stripe";
import { syncEntitlements } from "@/lib/billing/entitlements";
import Stripe from "stripe";

/**
 * POST /api/billing/webhook
 *
 * Stripe webhook receiver. Verifies signature using STRIPE_WEBHOOK_SECRET.
 * Handles: checkout.session.completed, customer.subscription.updated,
 * customer.subscription.deleted, invoice.paid.
 *
 * Per blueprint §4.8 FR-PAY-001:
 *   - Verify raw webhook signature/timestamp/replay
 *   - Dedupe (idempotent)
 *   - Reconcile provider state
 *   - Update entitlements transactionally
 *   - Browser redirect never grants access — only this webhook does
 *
 * IMPORTANT: This endpoint reads the raw body — Next.js must not parse it as JSON.
 */
export async function POST(req: NextRequest) {
  // Get raw body
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") || "";

  const event = verifyStripeWebhook(rawBody, signature);
  if ("error" in event) {
    return NextResponse.json(
      makeError("WEBHOOK_SIGNATURE_INVALID", "Webhook signature invalid", event.error, 400),
      { status: 400 }
    );
  }

  // Idempotency: check inbox by event id
  const externalEventId = event.id;
  const existing = await db.auditEvent.findFirst({
    where: { action: "stripe_webhook_processed", requestId: externalEventId },
  });
  if (existing) {
    return NextResponse.json({ ok: true, deduplicated: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;
        if (!userId) {
          await db.auditEvent.create({
            data: {
              actor: "stripe",
              action: "stripe_webhook_no_user",
              resourceType: "stripe_event",
              resourceId: externalEventId,
              requestId: externalEventId,
              metadata: JSON.stringify({ session }),
            },
          });
          return NextResponse.json({ ok: true, skipped: "no_user" });
        }

        // Find the plan by stripe price id
        const lineItems = session.line_items;
        const priceId = lineItems?.data?.[0]?.price?.id;
        const plan = priceId ? await db.plan.findFirst({ where: { stripePriceId: priceId } }) : null;
        if (!plan) {
          return NextResponse.json({ ok: false, error: "Plan not found for price id" }, { status: 200 });
        }

        // Update checkout session record
        await db.checkoutSession.updateMany({
          where: { externalId: session.id },
          data: { status: "completed", completedAt: new Date() },
        });

        // Create subscription record
        const checkoutSession = await db.checkoutSession.findFirst({ where: { externalId: session.id } });
        const stripeSubscriptionId = session.subscription as string;
        const existingSub = await db.subscription.findFirst({ where: { externalId: stripeSubscriptionId } });
        if (!existingSub) {
          await db.subscription.create({
            data: {
              userId,
              planId: plan.id,
              provider: "stripe",
              externalId: stripeSubscriptionId,
              status: "active",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
              checkoutSessionId: checkoutSession?.id,
            },
          });
        }

        // Sync entitlements — this is the ONLY place entitlements are granted
        await syncEntitlements(userId, stripeSubscriptionId, plan.code);

        // Invoice
        if (session.invoice) {
          const sub = await db.subscription.findFirst({ where: { externalId: stripeSubscriptionId } });
          if (sub) {
            await db.invoice.create({
              data: {
                userId,
                subscriptionId: sub.id,
                providerInvoiceId: session.invoice as string,
                amountMinor: plan.priceMinor,
                currency: plan.currency,
                state: "paid",
                paidAt: new Date(),
              },
            });
          }
        }

        await db.auditEvent.create({
          data: {
            userId,
            actor: "stripe",
            action: "subscription_activated",
            resourceType: "subscription",
            resourceId: stripeSubscriptionId,
            requestId: externalEventId,
            metadata: JSON.stringify({ sessionId: session.id, planCode: plan.code }),
          },
        });
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        const existingSub = await db.subscription.findFirst({ where: { externalId: sub.id } });
        if (existingSub) {
          await db.subscription.update({
            where: { id: existingSub.id },
            data: {
              status: sub.status,
              currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
              currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
              cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
            },
          });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        const existingSub = await db.subscription.findFirst({ where: { externalId: sub.id } });
        if (existingSub) {
          await db.subscription.update({
            where: { id: existingSub.id },
            data: { status: "canceled", canceledAt: new Date() },
          });
          // Revert to free entitlements
          await syncEntitlements(userId, null, "free");
        }
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.subscription as string;
        const existingSub = await db.subscription.findFirst({ where: { externalId: subId } });
        if (existingSub) {
          await db.invoice.create({
            data: {
              userId: existingSub.userId,
              subscriptionId: existingSub.id,
              providerInvoiceId: invoice.id,
              amountMinor: BigInt(invoice.amount_paid),
              currency: invoice.currency.toUpperCase(),
              state: "paid",
              paidAt: new Date(),
            },
          }).catch(() => null); // idempotent — unique constraint may fire
        }
        break;
      }
      default:
        // Unhandled event type — record but don't fail
        break;
    }

    // Record processed event for dedup
    await db.auditEvent.create({
      data: {
        actor: "stripe",
        action: "stripe_webhook_processed",
        resourceType: "stripe_event",
        resourceId: externalEventId,
        requestId: externalEventId,
        metadata: JSON.stringify({ type: event.type }),
      },
    });

    return NextResponse.json({ ok: true, type: event.type });
  } catch (e) {
    await db.auditEvent.create({
      data: {
        actor: "stripe",
        action: "stripe_webhook_error",
        resourceType: "stripe_event",
        resourceId: externalEventId,
        requestId: externalEventId,
        metadata: JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      },
    });
    return NextResponse.json(
      makeError("WEBHOOK_PROCESSING_FAILED", "Webhook processing failed", e instanceof Error ? e.message : "unknown", 500),
      { status: 500 }
    );
  }
}

/**
 * GET /api/billing/checkout-return
 *
 * Stripe redirect target after checkout. IMPORTANT: this endpoint is informational
 * only — the actual entitlement is granted by the webhook handler, not by visiting
 * this URL. If the user visits this without a webhook having fired, they will
 * NOT have Plus access.
 *
 * Per blueprint §4.8 FR-PAY-001: Browser redirect never grants access.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");
  const rillioCs = url.searchParams.get("cs_rillio");
  if (!user) {
    return NextResponse.redirect(new URL("/?view=settings&billing=return", req.url));
  }
  // Verify the checkout session was actually completed via Stripe
  if (sessionId) {
    const session = await retrieveCheckoutSession(sessionId);
    if ("error" in session) {
      return NextResponse.redirect(new URL("/?view=settings&billing=verification_failed", req.url));
    }
    if (session.payment_status === "paid" && session.client_reference_id === user.id) {
      // The webhook should have fired by now and granted entitlement.
      // If not, the user will see "processing" — the redirect does NOT grant access.
      await db.checkoutSession.updateMany({
        where: { externalId: sessionId },
        data: { status: "completed", completedAt: new Date() },
      });
      return NextResponse.redirect(new URL("/?view=settings&billing=return", req.url));
    }
  }
  if (rillioCs) {
    await db.checkoutSession.update({
      where: { id: rillioCs },
      data: { status: "completed", completedAt: new Date() },
    }).catch(() => null);
  }
  return NextResponse.redirect(new URL("/?view=settings&billing=return", req.url));
}
