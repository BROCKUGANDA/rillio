"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { formatMinor } from "@/lib/money";
import { ShieldIcon, SourceIcon, SparkIcon } from "@/components/rillio/icons";
import { CheckCircle2, AlertCircle, Zap, ExternalLink, CreditCard, Coins, RefreshCw } from "lucide-react";

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string;
  priceMinor: string;
  currency: string;
  interval: string;
  features: Record<string, string>;
  stripePriceId: string | null;
  usdcRecipient: string | null;
};

type Subscription = {
  id: string;
  status: string;
  provider: string;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  plan: Plan;
} | null;

type StripeConfig = {
  configured: boolean;
  publishableKey: string | null;
  webhookSecret: string | null;
  mode: "test" | "live" | "disabled";
};

type BillingData = {
  plans: Plan[];
  subscription: Subscription;
  entitlements: Record<string, string>;
  stripe: StripeConfig;
};

type UsdcIntent = {
  intentId: string;
  reference: string;
  recipient: string;
  mint: string;
  amountBaseUnits: string;
  amountDisplay: string;
  currency: string;
  expiry: string;
  instructions: string[];
};

export function BillingView() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutProvider, setCheckoutProvider] = useState<"stripe" | "usdc">("stripe");
  const [usdcIntent, setUsdcIntent] = useState<UsdcIntent | null>(null);
  const [usdcSignature, setUsdcSignature] = useState("");
  const [usdcVerifying, setUsdcVerifying] = useState(false);
  const [creatingCheckout, setCreatingCheckout] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<BillingData>("/api/billing/plans");
      setData(res);
    } catch (e) {
      toast.error("Failed to load billing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function startCheckout(provider: "stripe" | "usdc") {
    setCheckoutProvider(provider);
    setCreatingCheckout(true);
    setUsdcIntent(null);
    try {
      const res = await apiFetch<{
        provider: string;
        url?: string;
        sessionId?: string;
        checkoutSessionId?: string;
        intentId?: string;
        reference?: string;
        recipient?: string;
        mint?: string;
        amountBaseUnits?: string;
        amountDisplay?: string;
        currency?: string;
        expiry?: string;
        instructions?: string[];
        note?: string;
      }>("/api/billing/checkout-sessions", {
        method: "POST",
        body: JSON.stringify({ planCode: "plus", provider }),
      });
      if (provider === "stripe" && res.url) {
        // Redirect to Stripe-hosted checkout
        toast.info("Redirecting to Stripe…", { description: "Entitlement is granted only after the verified webhook confirms payment." });
        window.location.href = res.url;
        return;
      }
      if (provider === "usdc" && res.intentId) {
        setUsdcIntent({
          intentId: res.intentId,
          reference: res.reference!,
          recipient: res.recipient!,
          mint: res.mint!,
          amountBaseUnits: res.amountBaseUnits!,
          amountDisplay: res.amountDisplay!,
          currency: res.currency!,
          expiry: res.expiry!,
          instructions: res.instructions!,
        });
        setCheckoutOpen(true);
      }
    } catch (e) {
      const err = e as Error & { code?: string };
      toast.error(err.message);
    } finally {
      setCreatingCheckout(false);
    }
  }

  async function verifyUsdc() {
    if (!usdcIntent || !usdcSignature) {
      toast.error("Paste the transaction signature first.");
      return;
    }
    setUsdcVerifying(true);
    try {
      const res = await apiFetch<{
        verified: boolean;
        finalized: boolean;
        signature: string;
        note: string;
      }>("/api/billing/usdc/verify-payment", {
        method: "POST",
        body: JSON.stringify({
          intentId: usdcIntent.intentId,
          signature: usdcSignature,
        }),
      });
      toast.success("USDC payment verified. Rillio Plus is active.");
      setCheckoutOpen(false);
      setUsdcIntent(null);
      setUsdcSignature("");
      load();
    } catch (e) {
      const err = e as Error & { code?: string; retryable?: boolean };
      toast.error(err.message, { description: err.retryable ? "You can retry once the transaction confirms." : undefined });
    } finally {
      setUsdcVerifying(false);
    }
  }

  async function cancelSubscription() {
    try {
      await apiFetch("/api/billing/cancel", { method: "POST" });
      toast.success("Subscription will cancel at period end.");
      load();
    } catch (e) {
      toast.error("Failed to cancel.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-72 bg-ink-700 rounded-2xl" />
        <Skeleton className="h-64 w-full bg-ink-700 rounded-2xl" />
      </div>
    );
  }

  const plusPlan = data?.plans.find((p) => p.code === "plus");
  const freePlan = data?.plans.find((p) => p.code === "free");
  const hasPlus = data?.subscription?.plan.code === "plus";

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-3xl font-semibold">Billing</h1>
        <p className="text-sm text-slate-400 mt-1">
          Plans, checkout, invoices. Entitlement is reconciled server-side only after verified payment.
        </p>
      </div>

      {/* Current subscription */}
      {data?.subscription && hasPlus && (
        <Card className="bg-mint-400/5 border-mint-400/30">
          <CardContent className="p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-mint-400/15 flex items-center justify-center">
                <SparkIcon size={20} className="text-mint-400" />
              </div>
              <div>
                <div className="font-display text-base font-medium">Rillio Plus is active</div>
                <div className="text-xs text-slate-400">
                  {data.subscription.currentPeriodEnd && <>Renews {new Date(data.subscription.currentPeriodEnd).toLocaleDateString()} · </>}
                  via {data.subscription.provider}
                </div>
              </div>
            </div>
            <Button variant="outline" className="border-white/10" onClick={cancelSubscription}>
              Cancel at period end
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Free */}
        <Card className={`bg-ink-800 border-white/10 ${!hasPlus ? "border-mint-400/40" : ""}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="font-display text-xl font-semibold">Free</div>
              {!hasPlus && <Badge variant="outline" className="border-mint-400/30 text-mint-400">Current</Badge>}
            </div>
            <div className="num font-display text-3xl font-semibold mt-3">$0<span className="text-sm text-slate-400 font-sans">/mo</span></div>
            <p className="text-xs text-slate-400 mt-1">{freePlan?.description}</p>

            <ul className="mt-4 space-y-2 text-sm">
              <FeatureRow label="CSV imports" value="up to 1,000 rows" />
              <FeatureRow label="Goals" value="up to 3" />
              <FeatureRow label="Read-only Solana wallet" value="included" />
              <FeatureRow label="Privacy export" value="included" />
            </ul>
          </CardContent>
        </Card>

        {/* Plus */}
        <Card className={`bg-ink-800 border-white/10 relative overflow-hidden ${hasPlus ? "border-mint-400/40" : "ring-1 ring-lime-400/30"}`}>
          <div className="absolute top-0 right-0 px-3 py-1 text-[10px] font-medium gradient-brand text-ink-950 rounded-bl-lg">PLUS</div>
          <CardContent className="p-6">
            <div className="font-display text-xl font-semibold">Rillio Plus</div>
            <div className="num font-display text-3xl font-semibold mt-3">
              ${plusPlan ? formatMinor(BigInt(plusPlan.priceMinor), plusPlan.currency).replace(/\.\d+$/, "") : "8"}<span className="text-sm text-slate-400 font-sans">/mo</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{plusPlan?.description}</p>

            <ul className="mt-4 space-y-2 text-sm">
              <FeatureRow label="CSV imports" value="up to 100,000 rows" highlight />
              <FeatureRow label="Multi-account + multi-currency" value="included" highlight />
              <FeatureRow label="Recurring detection" value="included" highlight />
              <FeatureRow label="Custom rules" value="included" highlight />
              <FeatureRow label="Goals" value="up to 50" highlight />
              <FeatureRow label="Scenario planning" value="included" highlight />
              <FeatureRow label="Exports + portfolio analytics" value="included" highlight />
            </ul>

            {!hasPlus && (
              <div className="mt-5 space-y-2">
                <Button
                  onClick={() => startCheckout("stripe")}
                  disabled={creatingCheckout}
                  className="w-full bg-lime-400 text-ink-950 hover:bg-lime-400/90"
                >
                  <CreditCard size={14} className="mr-1.5" />
                  {creatingCheckout ? "Starting…" : "Subscribe with card"}
                </Button>
                <Button
                  onClick={() => startCheckout("usdc")}
                  disabled={creatingCheckout}
                  variant="outline"
                  className="w-full border-white/10"
                >
                  <Coins size={14} className="mr-1.5" />
                  Pay with USDC
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Boundary states */}
      {data && !hasPlus && (
        <Card className="bg-ink-800 border-white/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><ShieldIcon size={16} className="text-mint-400" /> Payment provider status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg p-3 bg-ink-850 border border-white/5 flex items-start gap-2">
              <CreditCard size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Stripe (card checkout)</span>
                  <Badge variant="outline" className={
                    data.stripe.configured
                      ? data.stripe.mode === "live" ? "border-mint-400/30 text-mint-400" : "border-warning-500/30 text-warning-500"
                      : "border-slate-500/30 text-slate-400"
                  }>
                    {data.stripe.configured ? data.stripe.mode : "disabled"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {data.stripe.configured
                    ? "Stripe is configured. Checkout creates a Stripe-hosted session; entitlement is granted only after the verified webhook confirms payment."
                    : "Stripe is not configured in this environment. Set STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_PLUS_PRICE_ID and STRIPE_WEBHOOK_SECRET to enable card checkout."}
                </p>
              </div>
            </div>

            <div className="rounded-lg p-3 bg-ink-850 border border-white/5 flex items-start gap-2">
              <Coins size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">USDC (onchain payment)</span>
                  <Badge variant="outline" className={
                    plusPlan?.usdcRecipient
                      ? "border-mint-400/30 text-mint-400"
                      : "border-slate-500/30 text-slate-400"
                  }>
                    {plusPlan?.usdcRecipient ? "ready" : "unconfigured"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {plusPlan?.usdcRecipient
                    ? "Pay $8 USDC on Solana. Server verifies the signature, exact amount, mint, recipient and reference onchain before granting entitlement."
                    : "Set USDC_RECIPIENT_WALLET and SOLANA_RPC_URL in the environment to enable USDC checkout."}
                </p>
              </div>
            </div>

            <div className="rounded-lg p-3 bg-warning-500/10 border border-warning-500/30 text-xs text-slate-300 flex items-start gap-2">
              <AlertCircle size={12} className="text-warning-500 flex-shrink-0 mt-0.5" />
              <span>
                <strong className="text-warning-500">Important:</strong> Browser redirects never grant entitlement. The success_url after Stripe checkout is informational only — your Plus access activates only when the verified webhook fires and reconciles your subscription server-side.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entitlements (current) */}
      <Card className="bg-ink-800 border-white/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><SourceIcon size={16} /> Your entitlements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            {data && Object.entries(data.entitlements).slice(0, 8).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded p-2 bg-ink-850 border border-white/5">
                <span className="text-slate-300 text-xs">{k.replace(/_/g, " ")}</span>
                <span className="num text-paper-100 text-xs">{v}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* USDC payment sheet */}
      <Sheet open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <SheetContent className="bg-ink-900 border-white/10 text-paper-100 w-full sm:max-w-lg overflow-y-auto">
          {usdcIntent && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display">Pay with USDC</SheetTitle>
                <SheetDescription className="text-slate-300">
                  Send exactly {usdcIntent.amountDisplay} USDC on Solana with the reference included.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="rounded-lg p-4 bg-ink-850 border border-white/5 space-y-2">
                  <Row label="Recipient" value={usdcIntent.recipient} mono copyable />
                  <Row label="Amount" value={`${usdcIntent.amountDisplay} USDC`} mono />
                  <Row label="Reference" value={usdcIntent.reference} mono copyable />
                  <Row label="Network" value="Solana mainnet" />
                  <Row label="Expires" value={new Date(usdcIntent.expiry).toLocaleString()} />
                </div>

                <div className="rounded-lg p-3 bg-mint-400/10 border border-mint-400/30 text-xs text-slate-300">
                  <strong className="text-mint-400">Read-only verification.</strong> Rillio never sees your private keys. The server verifies the onchain signature, exact amount, mint, recipient and reference after you submit the transfer.
                </div>

                <ol className="text-xs text-slate-400 space-y-1 list-decimal pl-4">
                  {usdcIntent.instructions.map((i, idx) => <li key={idx}>{i}</li>)}
                </ol>

                <div className="space-y-2">
                  <Label htmlFor="sig">Transaction signature</Label>
                  <Input
                    id="sig"
                    value={usdcSignature}
                    onChange={(e) => setUsdcSignature(e.target.value)}
                    placeholder="Paste the transaction signature after you submit the transfer"
                    className="bg-ink-850 border-white/10 font-mono text-xs"
                  />
                  <p className="text-[11px] text-slate-500">Wait for confirmation on Solana before verifying. The server checks finality onchain.</p>
                </div>

                <Button
                  onClick={verifyUsdc}
                  disabled={!usdcSignature || usdcVerifying}
                  className="w-full bg-lime-400 text-ink-950 hover:bg-lime-400/90"
                >
                  {usdcVerifying ? <><RefreshCw size={14} className="mr-1.5 animate-spin" /> Verifying onchain…</> : "Verify payment"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FeatureRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <CheckCircle2 size={14} className={highlight ? "text-mint-400" : "text-slate-400"} />
      <span className="text-slate-300">{label}</span>
      <span className="text-slate-400 ml-auto text-xs">{value}</span>
    </li>
  );
}

function Row({ label, value, mono, copyable }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-slate-400 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className={`text-xs text-paper-100 truncate ${mono ? "font-mono" : ""}`}>{value}</span>
        {copyable && (
          <button
            onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }}
            className="text-slate-500 hover:text-mint-400 flex-shrink-0"
            aria-label="Copy"
          >
            <ExternalLink size={10} />
          </button>
        )}
      </div>
    </div>
  );
}
