"use client";

/**
 * Billing — Solana-native payments only (USDC + native SOL).
 * No card processor. Entitlement is granted exclusively after
 * server-side onchain verification of the transfer.
 */

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
import { ShieldIcon, SourceIcon, SparkIcon } from "@/components/rillio/icons";
import { CheckCircle2, AlertCircle, ExternalLink, Coins, Wallet as WalletIcon, RefreshCw, Copy, Link2 } from "lucide-react";

type Plan = {
  id: string;
  code: string;
  name: string;
  description: string;
  priceMinor: string;
  currency: string;
  interval: string;
  features: Record<string, string>;
  usdcRecipient: string | null;
  solRecipient: string | null;
};

type Subscription = {
  id: string;
  status: string;
  provider: string;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  plan: Plan;
} | null;

type PaymentsConfig = {
  protocol: string;
  providers: string[];
  usdcConfigured: boolean;
  solConfigured: boolean;
  note: string;
};

type BillingData = {
  plans: Plan[];
  subscription: Subscription;
  entitlements: Record<string, string>;
  payments: PaymentsConfig;
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
  note?: string;
};

type SolIntent = {
  intentId: string;
  reference: string;
  recipient: string;
  lamports: string;
  solAmount: string;
  quotedSolPrice: number;
  pricingMode: "oracle" | "operator_fixed";
  expiry: string;
  solanaPayUrl: string;
  instructions: string[];
  note?: string;
};

type SheetKind = "usdc" | "sol" | null;

export function BillingView() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetKind, setSheetKind] = useState<SheetKind>(null);
  const [usdcIntent, setUsdcIntent] = useState<UsdcIntent | null>(null);
  const [solIntent, setSolIntent] = useState<SolIntent | null>(null);
  const [signature, setSignature] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [creatingCheckout, setCreatingCheckout] = useState<"usdc" | "sol" | null>(null);

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

  async function startCheckout(provider: "usdc" | "sol") {
    setCreatingCheckout(provider);
    setSignature("");
    try {
      const res = await apiFetch<UsdcIntent | SolIntent>("/api/billing/checkout-sessions", {
        method: "POST",
        body: JSON.stringify({ planCode: "plus", provider }),
      });
      if ("amountDisplay" in res) {
        setUsdcIntent(res);
        setSolIntent(null);
        setSheetKind("usdc");
      } else {
        setSolIntent(res);
        setUsdcIntent(null);
        setSheetKind("sol");
      }
    } catch (e) {
      const err = e as Error & { code?: string };
      toast.error(err.message, { description: err.code === "SOL_PRICE_UNAVAILABLE" ? "Try USDC instead — it's price-stable." : undefined });
    } finally {
      setCreatingCheckout(null);
    }
  }

  async function verifyPayment() {
    const intentId = sheetKind === "usdc" ? usdcIntent?.intentId : solIntent?.intentId;
    if (!intentId) return;
    if (!signature.trim()) {
      toast.error("Paste the transaction signature first.");
      return;
    }
    setVerifying(true);
    try {
      const res = await apiFetch<{ verified: boolean; finalized: boolean; signature: string; note: string }>(
        sheetKind === "usdc" ? "/api/billing/usdc/verify-payment" : "/api/billing/sol/verify-payment",
        { method: "POST", body: JSON.stringify({ intentId, signature: signature.trim() }) }
      );
      toast.success("Payment verified onchain. Rillio Plus is active.");
      setSheetKind(null);
      setUsdcIntent(null);
      setSolIntent(null);
      setSignature("");
      load();
    } catch (e) {
      const err = e as Error & { retryable?: boolean };
      toast.error(err.message, { description: err.retryable ? "Retry once the transaction confirms onchain." : undefined });
    } finally {
      setVerifying(false);
    }
  }

  async function cancelSubscription() {
    try {
      await apiFetch("/api/billing/cancel", { method: "POST" });
      toast.success("Subscription will end at period close.");
      load();
    } catch (e) {
      toast.error("Failed to cancel.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
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
          Solana-native payments — USDC or native SOL. Entitlement unlocks only after onchain verification.
        </p>
      </div>

      {/* Active subscription */}
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
                  paid via {data.subscription.provider.toUpperCase()} on Solana
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

        <Card className={`bg-ink-800 border-white/10 relative overflow-hidden ${hasPlus ? "border-mint-400/40" : "ring-1 ring-lime-400/30"}`}>
          <div className="absolute top-0 right-0 px-3 py-1 text-[10px] font-medium gradient-brand text-ink-950 rounded-bl-lg">PLUS</div>
          <CardContent className="p-6">
            <div className="font-display text-xl font-semibold">Rillio Plus</div>
            <div className="num font-display text-3xl font-semibold mt-3">$8<span className="text-sm text-slate-400 font-sans">/mo</span></div>
            <p className="text-xs text-slate-400 mt-1">{plusPlan?.description}</p>
            <ul className="mt-4 space-y-2 text-sm">
              <FeatureRow label="CSV imports" value="up to 100,000 rows" highlight />
              <FeatureRow label="Multi-account + multi-currency" value="included" highlight />
              <FeatureRow label="Recurring detection + custom rules" value="included" highlight />
              <FeatureRow label="Goals" value="up to 50" highlight />
              <FeatureRow label="Scenario planning + exports" value="included" highlight />
              <FeatureRow label="Portfolio analytics" value="included" highlight />
            </ul>

            {!hasPlus && (
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button
                  onClick={() => startCheckout("usdc")}
                  disabled={creatingCheckout !== null}
                  className="bg-lime-400 text-ink-950 hover:bg-lime-400/90 font-semibold"
                >
                  <Coins size={14} className="mr-1.5" />
                  {creatingCheckout === "usdc" ? "…" : "USDC"}
                </Button>
                <Button
                  onClick={() => startCheckout("sol")}
                  disabled={creatingCheckout !== null}
                  variant="outline"
                  className="border-white/10 font-semibold"
                >
                  <WalletIcon size={14} className="mr-1.5" />
                  {creatingCheckout === "sol" ? "…" : "SOL"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment provider status */}
      {!hasPlus && data && (
        <Card className="bg-ink-800 border-white/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><ShieldIcon size={16} className="text-mint-400" /> Payment protocol status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg p-3 bg-ink-850 border border-white/5 flex items-start gap-2">
              <Coins size={14} className="text-aqua-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">USDC (SPL token, mainnet)</span>
                  <Badge variant="outline" className={data.payments.usdcConfigured ? "border-mint-400/30 text-mint-400" : "border-slate-500/30 text-slate-400"}>
                    {data.payments.usdcConfigured ? "ready" : "unconfigured"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Exact $8.00 in 6-decimal base units. Server verifies mint, amount, recipient, reference and finality.
                </p>
              </div>
            </div>
            <div className="rounded-lg p-3 bg-ink-850 border border-white/5 flex items-start gap-2">
              <WalletIcon size={14} className="text-violet-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Native SOL (Solana Pay reference)</span>
                  <Badge variant="outline" className={data.payments.solConfigured ? "border-mint-400/30 text-mint-400" : "border-slate-500/30 text-slate-400"}>
                    {data.payments.solConfigured ? "ready" : "unconfigured"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Quoted at a live oracle price at intent creation; lamports verified via balance deltas. If no price source is available, no quote is issued — honestly.
                </p>
              </div>
            </div>
            <div className="rounded-lg p-3 bg-warning-500/10 border border-warning-500/30 text-xs text-slate-300 flex items-start gap-2">
              <AlertCircle size={12} className="text-warning-500 flex-shrink-0 mt-0.5" />
              <span>
                <strong className="text-warning-500">How access works:</strong> you send the transfer from your own wallet, paste the transaction signature, and the server checks it onchain before Plus unlocks. Rillio never sees your keys and holds nothing.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entitlements */}
      <Card className="bg-ink-800 border-white/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><SourceIcon size={16} /> Your entitlements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            {data && Object.entries(data.entitlements).slice(0, 10).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded p-2 bg-ink-850 border border-white/5">
                <span className="text-slate-300 text-xs">{k.replace(/_/g, " ")}</span>
                <span className="num text-paper-100 text-xs">{v}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* USDC payment sheet */}
      <Sheet open={sheetKind === "usdc"} onOpenChange={(o) => !o && setSheetKind(null)}>
        <SheetContent className="bg-ink-900 border-white/10 text-paper-100 w-full sm:max-w-lg overflow-y-auto">
          {usdcIntent && (
            <SolanaPaymentSheet
              title="Pay with USDC"
              description={`Send exactly ${usdcIntent.amountDisplay} USDC on Solana with the reference included.`}
              rows={[
                { label: "Recipient", value: usdcIntent.recipient, mono: true, copyable: true },
                { label: "Amount", value: `${usdcIntent.amountDisplay} USDC (${usdcIntent.amountBaseUnits} base units)`, mono: true, copyable: true },
                { label: "Reference", value: usdcIntent.reference, mono: true, copyable: true },
                { label: "Mint", value: usdcIntent.mint, mono: true, copyable: true },
                { label: "Network", value: "Solana mainnet" },
                { label: "Expires", value: new Date(usdcIntent.expiry).toLocaleString() },
              ]}
              instructions={usdcIntent.instructions}
              note={usdcIntent.note ?? "Read-only verification. Rillio never sees your private keys."}
              signature={signature}
              onSignatureChange={setSignature}
              onVerify={verifyPayment}
              verifying={verifying}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* SOL payment sheet */}
      <Sheet open={sheetKind === "sol"} onOpenChange={(o) => !o && setSheetKind(null)}>
        <SheetContent className="bg-ink-900 border-white/10 text-paper-100 w-full sm:max-w-lg overflow-y-auto">
          {solIntent && (
            <SolanaPaymentSheet
              title="Pay with native SOL"
              description={`Send exactly ${solIntent.solAmount} SOL (quoted at $${solIntent.quotedSolPrice.toFixed(2)}/SOL) with the Solana Pay reference.`}
              rows={[
                { label: "Recipient", value: solIntent.recipient, mono: true, copyable: true },
                { label: "Amount", value: `${solIntent.solAmount} SOL (${solIntent.lamports} lamports)`, mono: true, copyable: true },
                { label: "Reference", value: solIntent.reference, mono: true, copyable: true },
                { label: "Quoted price", value: `$${solIntent.quotedSolPrice.toFixed(2)} / SOL — ${solIntent.pricingMode === "oracle" ? "live oracle" : "operator-fixed rate (live sources unreachable, transparently recorded)"}` },
                { label: "Expires", value: new Date(solIntent.expiry).toLocaleString() },
              ]}
              solanaPayUrl={solIntent.solanaPayUrl}
              instructions={solIntent.instructions}
              note={solIntent.note ?? "Server verifies exact lamports via balance deltas, recipient and reference onchain."}
              signature={signature}
              onSignatureChange={setSignature}
              onVerify={verifyPayment}
              verifying={verifying}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* --------------------------- Shared payment sheet --------------------------- */

function SolanaPaymentSheet({
  title,
  description,
  rows,
  instructions,
  note,
  signature,
  onSignatureChange,
  onVerify,
  verifying,
  solanaPayUrl,
}: {
  title: string;
  description: string;
  rows: Array<{ label: string; value: string; mono?: boolean; copyable?: boolean }>;
  instructions: string[];
  note: string;
  signature: string;
  onSignatureChange: (v: string) => void;
  onVerify: () => void;
  verifying: boolean;
  solanaPayUrl?: string;
}) {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-display">{title}</SheetTitle>
        <SheetDescription className="text-slate-300">{description}</SheetDescription>
      </SheetHeader>
      <div className="mt-6 space-y-4">
        <div className="rounded-lg p-4 bg-ink-850 border border-white/5 space-y-2">
          {rows.map((r) => (
            <Row key={r.label} label={r.label} value={r.value} mono={r.mono} copyable={r.copyable} />
          ))}
        </div>

        {solanaPayUrl && (
          <div className="rounded-lg p-3 bg-violet-400/10 border border-violet-400/30">
            <div className="text-xs text-violet-400 font-medium mb-1.5 flex items-center gap-1.5">
              <Link2 size={12} /> Solana Pay transfer link
            </div>
            <p className="text-[11px] text-slate-400 break-all font-mono leading-relaxed">{solanaPayUrl}</p>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-white/10 text-xs"
                onClick={() => { navigator.clipboard.writeText(solanaPayUrl); toast.success("Solana Pay link copied"); }}
              >
                <Copy size={12} className="mr-1" /> Copy link
              </Button>
              <a
                href={solanaPayUrl}
                className="h-8 px-3 rounded-md border border-white/10 text-xs inline-flex items-center hover:bg-white/5 transition-colors"
              >
                Open in wallet
              </a>
            </div>
          </div>
        )}

        <div className="rounded-lg p-3 bg-mint-400/10 border border-mint-400/30 text-xs text-slate-300">
          <strong className="text-mint-400">Read-only verification.</strong> {note}
        </div>

        <ol className="text-xs text-slate-400 space-y-1 list-decimal pl-4">
          {instructions.map((i, idx) => <li key={idx}>{i}</li>)}
        </ol>

        <div className="space-y-2">
          <Label htmlFor="paysig">Transaction signature</Label>
          <Input
            id="paysig"
            value={signature}
            onChange={(e) => onSignatureChange(e.target.value)}
            placeholder="Paste the transaction signature after sending"
            className="bg-ink-850 border-white/10 font-mono text-xs"
          />
          <p className="text-[11px] text-slate-500">Wait for confirmation on Solana before verifying — the server checks finality onchain.</p>
        </div>

        <Button
          onClick={onVerify}
          disabled={!signature.trim() || verifying}
          className="w-full bg-lime-400 text-ink-950 hover:bg-lime-400/90 font-semibold"
        >
          {verifying ? <><RefreshCw size={14} className="mr-1.5 animate-spin" /> Verifying onchain…</> : "Verify payment"}
        </Button>
      </div>
    </>
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
            <Copy size={10} />
          </button>
        )}
      </div>
    </div>
  );
}
