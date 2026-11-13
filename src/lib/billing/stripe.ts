/**
 * Stripe billing integration.
 *
 * Per blueprint §4.8 FR-PAY-001 P0 for paid launch:
 *   - Subscription checkout, webhooks, cancellation, invoices, entitlement reconciliation
 *   - Browser redirect never grants access — only verified webhooks do
 *
 * Real Stripe SDK is used when STRIPE_SECRET_KEY is configured.
 * When not configured, the boundary is surfaced honestly (checkout disabled).
 */

import Stripe from "stripe";

let cachedClient: Stripe | null = null;

export function getStripeConfig(): {
  configured: boolean;
  publishableKey: string | null;
  webhookSecret: string | null;
  mode: "test" | "live" | "disabled";
} {
  const secretKey = process.env.STRIPE_SECRET_KEY || null;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || null;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || null;
  const mode: "test" | "live" | "disabled" = secretKey
    ? secretKey.startsWith("sk_test")
      ? "test"
      : "live"
    : "disabled";
  return {
    configured: !!secretKey,
    publishableKey,
    webhookSecret,
    mode,
  };
}

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!cachedClient) {
    cachedClient = new Stripe(secretKey, {
      apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
      typescript: true,
    });
  }
  return cachedClient;
}

/**
 * Verify a Stripe webhook signature using the official SDK.
 * Per blueprint §4.8 FR-PAY-001: Verify raw webhook signature/timestamp/replay.
 */
export function verifyStripeWebhook(payload: string | Buffer, signature: string): Stripe.Event | { error: string } {
  const config = getStripeConfig();
  if (!config.webhookSecret) {
    return { error: "STRIPE_WEBHOOK_SECRET not configured. Cannot verify webhook signature." };
  }
  const client = getStripeClient();
  if (!client) {
    return { error: "STRIPE_SECRET_KEY not configured." };
  }
  try {
    return client.webhooks.constructEvent(payload, signature, config.webhookSecret);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Webhook signature verification failed." };
  }
}

/**
 * Create a Stripe Checkout Session for a subscription.
 *
 * Returns the URL to redirect the user to. IMPORTANT: the redirect alone does
 * NOT grant entitlement — the entitlement is only set when the
 * `checkout.session.completed` webhook fires and is reconciled server-side.
 */
export async function createCheckoutSession(opts: {
  userId: string;
  userEmail: string;
  planStripePriceId: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}): Promise<{ url: string; sessionId: string } | { error: string }> {
  const client = getStripeClient();
  if (!client) {
    return { error: "STRIPE_SECRET_KEY not configured. Checkout is disabled." };
  }
  try {
    const session = await client.checkout.sessions.create(
      {
        mode: "subscription",
        customer_email: opts.userEmail,
        line_items: [{ price: opts.planStripePriceId, quantity: 1 }],
        success_url: opts.successUrl,
        cancel_url: opts.cancelUrl,
        client_reference_id: opts.userId,
        metadata: {
          userId: opts.userId,
          idempotencyKey: opts.idempotencyKey,
        },
        subscription_data: {
          metadata: { userId: opts.userId },
        },
      },
      { idempotencyKey: opts.idempotencyKey }
    );
    return { url: session.url!, sessionId: session.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create checkout session." };
  }
}

/**
 * Retrieve a Stripe Checkout Session by id (for post-redirect verification).
 * Note: this is informational only — entitlement is granted via webhook.
 */
export async function retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session | { error: string }> {
  const client = getStripeClient();
  if (!client) {
    return { error: "STRIPE_SECRET_KEY not configured." };
  }
  try {
    return await client.checkout.sessions.retrieve(sessionId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to retrieve session." };
  }
}

/**
 * Cancel a Stripe subscription at period end.
 */
export async function cancelSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription | { error: string }> {
  const client = getStripeClient();
  if (!client) {
    return { error: "STRIPE_SECRET_KEY not configured." };
  }
  try {
    return await client.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to cancel subscription." };
  }
}

/**
 * List invoices for a customer (max 24).
 */
export async function listInvoices(customerId: string): Promise<Stripe.Invoice[]> {
  const client = getStripeClient();
  if (!client) return [];
  try {
    const list = await client.invoices.list({ customer: customerId, limit: 24 });
    return list.data;
  } catch {
    return [];
  }
}
