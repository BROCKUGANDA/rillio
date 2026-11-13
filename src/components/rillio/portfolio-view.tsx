"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api-client";
import { formatMinor, formatTokenAmount } from "@/lib/money";
import { OrbitIcon, ShieldIcon, SourceIcon } from "@/components/rillio/icons";
import { toast } from "sonner";
import { Wallet as WalletIcon, Trash2, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";

// Browser wallet adapter abstraction (Wallet Standard / window.solana / window.phantom)
type WalletAdapter = {
  name: string;
  connect: () => Promise<{ address: string }>;
  signMessage: (message: string) => Promise<string>;
  disconnect?: () => Promise<void>;
};

type AnyWindow = typeof window & {
  solana?: { isPhantom?: boolean; connect: () => Promise<{ publicKey: { toString: () => string } }>; signMessage: (data: Uint8Array, display: string) => Promise<Uint8Array> };
  phantom?: { solana?: AnyWindow["solana"] };
  Backpack?: { connect: () => Promise<{ publicKey: { toString: () => string } }>; signMessage: (data: Uint8Array) => Promise<Uint8Array> } & Record<string, unknown>;
  solflare?: { connect: () => Promise<{ publicKey: { toString: () => string } }>; signMessage: (data: Uint8Array) => Promise<Uint8Array> };
};

function detectWalletAdapters(): WalletAdapter[] {
  if (typeof window === "undefined") return [];
  const w = window as AnyWindow;
  const adapters: WalletAdapter[] = [];
  const solana = w.solana || w.phantom?.solana;
  if (solana && typeof solana.connect === "function") {
    adapters.push({
      name: "Phantom",
      connect: async () => {
        const res = await solana.connect();
        return { address: res.publicKey.toString() };
      },
      signMessage: async (message: string) => {
        const data = new TextEncoder().encode(message);
        const sig = await solana.signMessage(data, "utf8");
        // Convert bytes to base58
        return bytesToBase58(sig);
      },
    });
  }
  if (w.solflare && typeof w.solflare.connect === "function") {
    adapters.push({
      name: "Solflare",
      connect: async () => {
        const res = await w.solflare!.connect();
        return { address: res.publicKey.toString() };
      },
      signMessage: async (message: string) => {
        const data = new TextEncoder().encode(message);
        const sig = await w.solflare!.signMessage(data);
        return bytesToBase58(sig);
      },
    });
  }
  if (w.Backpack && typeof w.Backpack.connect === "function") {
    adapters.push({
      name: "Backpack",
      connect: async () => {
        const res = await (w.Backpack as { connect: () => Promise<{ publicKey: { toString: () => string } }> }).connect();
        return { address: res.publicKey.toString() };
      },
      signMessage: async (message: string) => {
        const data = new TextEncoder().encode(message);
        const sig = await (w.Backpack as { signMessage: (data: Uint8Array) => Promise<Uint8Array> }).signMessage(data);
        return bytesToBase58(sig);
      },
    });
  }
  return adapters;
}

// Convert Uint8Array to base58 string (matches Solana wallet signature encoding)
function bytesToBase58(bytes: Uint8Array): string {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt("0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(""));
  let str = "";
  while (num > 0n) {
    const rem = num % 58n;
    num = num / 58n;
    str = ALPHABET[Number(rem)] + str;
  }
  // Leading zero bytes → "1"
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) str = "1" + str;
  return str;
}

type Boundary = { kind: "ok" | "not_configured"; reason?: string; guidance?: string; cluster?: string; rpcUrl?: string };

type Wallet = {
  id: string;
  address: string;
  verification: string;
  chain: string;
  disconnectedAt: string | null;
  tokenAccounts: TokenAccount[];
};

type TokenAccount = {
  mint: string;
  symbol: string | null;
  name: string | null;
  baseUnitAmount: string;
  decimals: number;
  priceQuoteUsd: string | null;
  priceSource: string | null;
  priceObservedAt: string | null;
  verified: boolean;
  unpriced: boolean;
};

type WalletsResp = { wallets: Wallet[]; boundary: Boundary };
type PortfolioResp = {
  hasWallet: boolean;
  boundary: Boundary;
  totalUsdMinor: string | null;
  pricedAssetCount: number;
  unpricedAssetCount: number;
  unverifiedAssetCount: number;
  snapshotAt: string;
  stale: boolean;
  assets?: Array<{
    mint: string;
    symbol: string | null;
    name: string | null;
    baseUnitAmount: string;
    decimals: number;
    priceUsd: string | null;
    priceSource: string | null;
    priceObservedAt: string | null;
    verified: boolean;
    unpriced: boolean;
    valueUsdMinor: string | null;
    walletAddress: string;
  }>;
};

export function PortfolioView({ user }: { user: { baseCurrency: string; displayName: string | null } }) {
  const [walletsResp, setWalletsResp] = useState<WalletsResp | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [walletAdapter, setWalletAdapter] = useState<WalletAdapter | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Detect Solana wallet adapters in the browser (Wallet Standard / window.solana / window.phantom)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const poll = () => {
      const adapters = detectWalletAdapters();
      if (adapters.length > 0) setWalletAdapter(adapters[0]);
    };
    poll();
    const t = setInterval(poll, 1500);
    return () => clearInterval(t);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [w, p] = await Promise.all([
        apiFetch<WalletsResp>("/api/wallets"),
        apiFetch<PortfolioResp>("/api/portfolio/summary"),
      ]);
      setWalletsResp(w);
      setPortfolio(p);
    } catch (e) {
      toast.error("Failed to load portfolio.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function connect() {
    setConnecting(true);
    try {
      let walletAddress = address;
      let signature: string | null = null;
      let message = "";

      // If a browser wallet adapter is available, use it to connect + sign
      if (walletAdapter) {
        toast.info(`Connecting to ${walletAdapter.name}…`);
        const conn = await walletAdapter.connect();
        walletAddress = conn.address;
        setAddress(conn.address);

        // Issue challenge from server
        const challenge = await apiFetch<{ message: string; nonce: string; expiresAt: string; boundary: Boundary }>(
          "/api/wallets/challenge",
          { method: "POST", body: JSON.stringify({ address: walletAddress }) }
        );
        message = challenge.message;
        // Ask the wallet to sign the challenge
        try {
          const sig = await walletAdapter.signMessage(challenge.message);
          signature = sig; // base58 or base64
          toast.info("Signature obtained. Verifying onchain…");
        } catch (e) {
          // User declined signature — proceed as unverified
          toast.warning("Signature declined. Wallet will be connected as unverified.");
          signature = null;
        }
      } else if (!address) {
        toast.error("No browser wallet detected. Enter a Solana address manually to connect as unverified, or install Phantom/Solflare.");
        return;
      }

      // Issue challenge if not already issued (manual address path)
      if (!message) {
        const challenge = await apiFetch<{ message: string; nonce: string; expiresAt: string; boundary: Boundary }>(
          "/api/wallets/challenge",
          { method: "POST", body: JSON.stringify({ address: walletAddress }) }
        );
        message = challenge.message;
        const verify = await apiFetch<{ wallet: Wallet; verified: boolean; verificationReason: string | null; boundary: Boundary; observation?: { error?: string; triggered?: boolean } }>(
          "/api/wallets/verify",
          { method: "POST", body: JSON.stringify({ address: walletAddress, signature: null, nonce: challenge.nonce, message: challenge.message }) }
        );
        handleVerifyResult(verify);
        return;
      }

      const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
      const nonce = nonceMatch ? nonceMatch[1] : "";
      const verify = await apiFetch<{ wallet: Wallet; verified: boolean; verificationReason: string | null; boundary: Boundary; observation?: { error?: string; triggered?: boolean } }>(
        "/api/wallets/verify",
        { method: "POST", body: JSON.stringify({ address: walletAddress, signature, nonce, message }) }
      );
      handleVerifyResult(verify);
    } catch (e) {
      const err = e as Error;
      toast.error(err.message);
    } finally {
      setConnecting(false);
    }
  }

  function handleVerifyResult(verify: { wallet: Wallet; verified: boolean; verificationReason: string | null; boundary: Boundary; observation?: { error?: string; triggered?: boolean } }) {
    if (verify.verified) {
      toast.success("Wallet connected and verified by ed25519 signature.");
    } else {
      toast.warning("Wallet connected as unverified.", {
        description: verify.verificationReason ?? undefined,
      });
    }
    if (verify.observation?.error) {
      toast.error("Portfolio observation failed.", { description: verify.observation.error });
    } else if (verify.observation?.triggered && verify.boundary.kind === "ok") {
      toast.success("Real balances fetched from Solana RPC.");
    }
    setConnectOpen(false);
    setAddress("");
    load();
  }

  async function refreshWallet(id: string) {
    setRefreshingId(id);
    try {
      const res = await apiFetch<{ ok: boolean; stale: boolean; error: string | null; pricedAssetCount: number; unpricedAssetCount: number; totalUsdMinor: string | null; observedAt: string }>(`/api/wallets/${id}/refresh`, { method: "POST" });
      if (res.ok) {
        toast.success(`Refreshed. ${res.pricedAssetCount} priced, ${res.unpricedAssetCount} unpriced.`);
      } else {
        toast.warning("Refresh returned stale data.", { description: res.error ?? undefined });
      }
      load();
    } catch (e) {
      toast.error("Refresh failed.");
    } finally {
      setRefreshingId(null);
    }
  }

  async function disconnect(id: string) {
    try {
      await apiFetch(`/api/wallets/${id}`, { method: "DELETE" });
      toast.success("Wallet disconnected. Indexing stopped.");
      load();
    } catch (e) {
      toast.error("Failed to disconnect.");
    }
  }

  const boundary = walletsResp?.boundary ?? portfolio?.boundary;
  const activeWallets = walletsResp?.wallets.filter((w) => !w.disconnectedAt) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">What you own</h1>
          <p className="text-sm text-slate-400 mt-1">
            Read-only Solana portfolio visibility. Rillio never requests your private keys or signs transactions.
          </p>
        </div>
        <Button onClick={() => setConnectOpen(true)} className="bg-lime-400 text-ink-950 hover:bg-lime-400/90">
          <WalletIcon size={16} className="mr-1.5" /> Connect wallet
        </Button>
      </div>

      {/* Boundary state */}
      {boundary && boundary.kind === "not_configured" && (
        <Card className="bg-warning-500/5 border-warning-500/30">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="text-warning-500 flex-shrink-0 mt-0.5" size={18} />
            <div className="text-sm">
              <div className="font-medium text-warning-500">Solana RPC not configured</div>
              <p className="text-slate-300 mt-1">{boundary.guidance ?? boundary.reason}</p>
              <p className="text-xs text-slate-500 mt-2">
                Rillio surfaces this honestly rather than fabricating balances. You can still register a wallet address; balances will appear once a real RPC is configured by an operator.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-ink-800 border-white/10">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <OrbitIcon size={14} className="text-violet-400" /> Total supported value
            </div>
            {loading ? (
              <Skeleton className="h-8 w-32 bg-ink-700 mt-2" />
            ) : portfolio && portfolio.hasWallet ? (
              <>
                <div className="num font-display text-3xl font-semibold mt-2 text-paper-100">
                  {portfolio.totalUsdMinor ? formatMinor(BigInt(portfolio.totalUsdMinor), "USD") : "—"}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Snapshot {new Date(portfolio.snapshotAt).toLocaleString()}
                  {portfolio.stale && <Badge variant="outline" className="ml-2 text-[10px] border-warning-500/30 text-warning-500">Stale</Badge>}
                </div>
              </>
            ) : (
              <div className="text-slate-500 text-sm mt-2">No priced assets</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-ink-800 border-white/10">
          <CardContent className="p-5">
            <div className="text-xs text-slate-400">Asset coverage</div>
            {loading ? (
              <Skeleton className="h-8 w-32 bg-ink-700 mt-2" />
            ) : portfolio ? (
              <div className="flex gap-2 flex-wrap mt-2">
                <Badge variant="outline" className="border-mint-400/30 text-mint-400">{portfolio.pricedAssetCount} priced</Badge>
                <Badge variant="outline" className="border-warning-500/30 text-warning-500">{portfolio.unpricedAssetCount} unpriced</Badge>
                <Badge variant="outline" className="border-violet-400/30 text-violet-400">{portfolio.unverifiedAssetCount} unverified</Badge>
              </div>
            ) : null}
            <p className="text-xs text-slate-500 mt-2">
              Unknown, spam, unpriced and frozen tokens are labelled — never silently excluded.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-ink-800 border-white/10">
          <CardContent className="p-5">
            <div className="text-xs text-slate-400">Connected wallets</div>
            {loading ? (
              <Skeleton className="h-8 w-32 bg-ink-700 mt-2" />
            ) : (
              <div className="num font-display text-3xl font-semibold mt-2 text-paper-100">{activeWallets.length}</div>
            )}
            <div className="text-xs text-slate-500 mt-1">Across Solana</div>
          </CardContent>
        </Card>
      </div>

      {/* Wallets list */}
      <div className="space-y-3">
        {loading ? (
          <Skeleton className="h-32 bg-ink-700 rounded-2xl" />
        ) : activeWallets.length === 0 ? (
          <Card className="bg-ink-800 border-white/10">
            <CardContent className="p-12 text-center">
              <WalletIcon className="mx-auto text-slate-500 mb-3" size={32} />
              <h3 className="text-sm font-medium text-paper-100">Connect a wallet to view supported Solana assets.</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Rillio cannot access your private keys. Connecting is read-only and never signs a transaction.
              </p>
              <Button onClick={() => setConnectOpen(true)} className="mt-4 bg-lime-400 text-ink-950 hover:bg-lime-400/90">
                Connect wallet
              </Button>
            </CardContent>
          </Card>
        ) : (
          activeWallets.map((w) => (
            <Card key={w.id} className="bg-ink-800 border-white/10">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-display text-base font-medium">Solana wallet</div>
                      <Badge
                        variant="outline"
                        className={
                          w.verification === "verified"
                            ? "border-mint-400/30 text-mint-400 text-[10px]"
                            : "border-warning-500/30 text-warning-500 text-[10px]"
                        }
                      >
                        {w.verification}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 font-mono">
                      {w.address.slice(0, 6)}…{w.address.slice(-6)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://explorer.solana.com/address/${w.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-400 hover:text-mint-400 flex items-center gap-1"
                    >
                      Explorer <ExternalLink size={12} />
                    </a>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => refreshWallet(w.id)}
                      disabled={refreshingId === w.id || boundary?.kind === "not_configured"}
                      className="border-white/10 h-8"
                    >
                      <RefreshCw size={12} className={refreshingId === w.id ? "mr-1 animate-spin" : "mr-1"} />
                      {refreshingId === w.id ? "" : "Refresh"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger-500 hover:text-danger-500"
                      onClick={() => disconnect(w.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

                {/* Token accounts */}
                {w.tokenAccounts.length === 0 ? (
                  <div className="mt-4 rounded-lg p-3 bg-ink-850 border border-white/5 text-xs text-slate-400">
                    {boundary?.kind === "not_configured"
                      ? "No balances observed yet — RPC endpoint not configured by the operator."
                      : "No balances observed yet for this wallet."}
                  </div>
                ) : (
                  <div className="mt-4 divide-y divide-white/5 rounded-lg border border-white/5 bg-ink-850">
                    {w.tokenAccounts.map((ta) => (
                      <AssetRow
                        key={ta.mint}
                        mint={ta.mint}
                        symbol={ta.symbol}
                        name={ta.name}
                        baseUnitAmount={ta.baseUnitAmount}
                        decimals={ta.decimals}
                        priceUsd={ta.priceQuoteUsd}
                        priceSource={ta.priceSource}
                        priceObservedAt={ta.priceObservedAt}
                        verified={ta.verified}
                        unpriced={ta.unpriced}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Connect sheet */}
      <Sheet open={connectOpen} onOpenChange={setConnectOpen}>
        <SheetContent className="bg-ink-900 border-white/10 text-paper-100 w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display">Connect a wallet</SheetTitle>
            <SheetDescription className="text-slate-300">
              Read-only connection. We never request a transaction, transfer, or your private keys.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="rounded-lg p-3 bg-mint-400/10 border border-mint-400/30 flex items-start gap-2">
              <ShieldIcon size={16} className="text-mint-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300">
                Rillio requests a short-lived, domain-bound signing challenge. We verify the signature cryptographically using ed25519 (tweetnacl). If no browser wallet is detected, you can paste an address manually — it will be marked <strong>unverified</strong> and clearly labelled.
              </div>
            </div>

            {walletAdapter && (
              <div className="rounded-lg p-3 bg-mint-400/10 border border-mint-400/30">
                <div className="text-xs text-mint-400 font-medium mb-1">Browser wallet detected</div>
                <p className="text-xs text-slate-300">
                  {walletAdapter.name} is available. Click connect to request a signed challenge — your private key never leaves your wallet.
                </p>
              </div>
            )}

            {!walletAdapter && (
              <div className="rounded-lg p-3 bg-warning-500/10 border border-warning-500/30">
                <div className="text-xs text-warning-500 font-medium mb-1">No browser wallet detected</div>
                <p className="text-xs text-slate-300">
                  Install Phantom, Solflare, or Backpack to verify wallet ownership cryptographically. You can still connect an address manually as <strong>unverified</strong>.
                </p>
              </div>
            )}

            {walletAdapter ? (
              <Button onClick={connect} disabled={connecting} className="w-full bg-lime-400 text-ink-950 hover:bg-lime-400/90">
                <WalletIcon size={14} className="mr-1.5" />
                {connecting ? "Connecting…" : `Connect with ${walletAdapter.name}`}
              </Button>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="addr">Solana wallet address (manual)</Label>
                  <Input
                    id="addr"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83eZRuhxJYgQk"
                    className="bg-ink-850 border-white/10 font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500">Paste a base58 Solana address (32–44 characters). Will be marked unverified.</p>
                </div>
                <Button onClick={connect} disabled={connecting || !address} className="w-full bg-lime-400 text-ink-950 hover:bg-lime-400/90">
                  {connecting ? "Connecting…" : "Connect as unverified"}
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AssetRow({
  mint,
  symbol,
  name,
  baseUnitAmount,
  decimals,
  priceUsd,
  priceSource,
  priceObservedAt,
  verified,
  unpriced,
}: {
  mint: string;
  symbol: string | null;
  name: string | null;
  baseUnitAmount: string;
  decimals: number;
  priceUsd: string | null;
  priceSource: string | null;
  priceObservedAt: string | null;
  verified: boolean;
  unpriced: boolean;
}) {
  const amount = formatTokenAmount(baseUnitAmount, decimals);
  const valueUsd = priceUsd && !unpriced
    ? (Number(baseUnitAmount) / Math.pow(10, decimals)) * Number(priceUsd)
    : null;
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-paper-100">{symbol ?? "Unknown token"}</span>
          {!verified && <Badge variant="outline" className="text-[10px] border-warning-500/30 text-warning-500">unverified</Badge>}
          {unpriced && <Badge variant="outline" className="text-[10px] border-slate-500/30 text-slate-400">unpriced</Badge>}
        </div>
        <div className="text-xs text-slate-500 truncate">
          {name ?? "Metadata unavailable"} · <span className="font-mono">{mint.slice(0, 8)}…{mint.slice(-6)}</span>
        </div>
        {priceSource && priceObservedAt && (
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
            <SourceIcon size={10} /> {priceSource} · {new Date(priceObservedAt).toLocaleString()}
          </div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <div className="num text-sm font-medium text-paper-100">{amount}</div>
        {valueUsd !== null ? (
          <div className="num text-xs text-mint-400">${valueUsd.toFixed(2)}</div>
        ) : (
          <div className="text-[10px] text-slate-500">No reliable price</div>
        )}
      </div>
    </div>
  );
}
