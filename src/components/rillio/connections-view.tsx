"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { SourceIcon, ShieldIcon } from "@/components/rillio/icons";
import { RefreshCw, Trash2, Plug, CheckCircle2, AlertCircle } from "lucide-react";

type ProviderInfo = {
  code: string;
  name: string;
  description: string;
  regions: string[];
  features: string[];
  isAvailable: boolean;
  availabilityNote?: string;
  isDemo?: boolean;
  connections: Array<{ id: string; provider: string; status: string; lastSyncAt: string | null; lastSyncStatus: string | null; syncCount: number }>;
};

type ProvidersResp = { providers: ProviderInfo[] };
type ConnectionsResp = {
  connections: Array<{ id: string; provider: string; status: string; lastSyncAt: string | null; lastSyncStatus: string | null; lastSyncError: string | null; syncCount: number; accountsJson: string | null; createdAt: string }>;
  consents: Array<{ id: string; provider: string; scope: string; grantedAt: string }>;
};

export function ConnectionsView({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [connections, setConnections] = useState<ConnectionsResp["connections"]>([]);
  const [consents, setConsents] = useState<ConnectionsResp["consents"]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<ProviderInfo | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        apiFetch<ProvidersResp>("/api/connections/providers"),
        apiFetch<ConnectionsResp>("/api/connections"),
      ]);
      setProviders(p.providers);
      setConnections(c.connections);
      setConsents(c.consents);
    } catch (e) {
      toast.error("Failed to load connections.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function connect() {
    if (!connectingProvider) return;
    setConnecting(true);
    try {
      await apiFetch("/api/connections", {
        method: "POST",
        body: JSON.stringify({
          providerCode: connectingProvider.code,
          consentScope: "transactions:read",
        }),
      });
      toast.success(`${connectingProvider.name} connected. Sync to import transactions.`);
      setConnectingProvider(null);
      setConsentAccepted(false);
      load();
    } catch (e) {
      const err = e as Error & { code?: string };
      toast.error(err.message);
    } finally {
      setConnecting(false);
    }
  }

  async function sync(id: string) {
    setSyncingId(id);
    try {
      const res = await apiFetch<{
        ok: boolean;
        accepted: number;
        duplicate: number;
        rejected: number;
        isDemo?: boolean;
        errors?: Array<{ row: number; field: string; code: string; message: string }>;
      }>(`/api/connections/${id}/sync`, { method: "POST", body: JSON.stringify({ days: 90 }) });
      toast.success(
        `Synced: ${res.accepted} new, ${res.duplicate} duplicates, ${res.rejected} rejected.`,
        { description: res.isDemo ? "Demo provider — synthetic test data" : undefined }
      );
      load();
      onNavigate("activity");
    } catch (e) {
      toast.error("Sync failed.");
    } finally {
      setSyncingId(null);
    }
  }

  async function revoke(id: string) {
    try {
      await apiFetch(`/api/connections/${id}`, { method: "DELETE" });
      toast.success("Connection revoked. No new syncs will occur.");
      load();
    } catch (e) {
      toast.error("Failed to revoke.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Bank connections</h1>
        <p className="text-sm text-slate-400 mt-1">
          Connect a financial-data provider behind an explicit consent. Revoke any time.
        </p>
      </div>

      {/* Active consents banner */}
      {consents.length > 0 && (
        <Card className="bg-mint-400/5 border-mint-400/30">
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldIcon size={18} className="text-mint-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-mint-400">Active consents</div>
              <p className="text-slate-300 mt-1">
                You have {consents.length} active consent{consents.length !== 1 ? "s" : ""}. Revoke a connection below to withdraw consent — no new syncs will occur.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provider catalog */}
      <div>
        <h2 className="text-sm font-medium text-slate-300 mb-3">Available providers</h2>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 bg-ink-700 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {providers.map((p) => (
              <Card key={p.code} className="bg-ink-800 border-white/10">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-base font-medium">{p.name}</span>
                        {p.isDemo && <Badge variant="outline" className="text-[10px] border-violet-400/30 text-violet-400">DEMO</Badge>}
                        {!p.isAvailable && <Badge variant="outline" className="text-[10px] border-warning-500/30 text-warning-500">unavailable</Badge>}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-snug">{p.description}</p>
                    </div>
                    <Plug size={18} className="text-slate-500 flex-shrink-0" />
                  </div>

                  <div className="flex gap-1.5 flex-wrap mt-3">
                    {p.features.map((f) => (
                      <Badge key={f} variant="outline" className="text-[10px] border-white/10 text-slate-300">{f}</Badge>
                    ))}
                  </div>

                  {p.connections.length > 0 ? (
                    <div className="mt-4 rounded-lg p-3 bg-ink-850 border border-white/5 space-y-2">
                      {p.connections.map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={12} className="text-mint-400" />
                            <span className="text-slate-300">Connected</span>
                            {c.lastSyncStatus && (
                              <Badge variant="outline" className="text-[10px] border-white/10 text-slate-400">{c.lastSyncStatus}</Badge>
                            )}
                          </div>
                          <span className="text-slate-500">{c.syncCount} syncs</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => { setConnectingProvider(p); setConsentAccepted(false); }}
                      disabled={!p.isAvailable}
                      className="mt-4 bg-lime-400 text-ink-950 hover:bg-lime-400/90"
                    >
                      Connect
                    </Button>
                  )}

                  {!p.isAvailable && p.availabilityNote && (
                    <p className="text-[11px] text-warning-500 mt-2">{p.availabilityNote}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Active connections */}
      {connections.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-slate-300 mb-3">Your connections</h2>
          <div className="space-y-3">
            {connections.map((c) => {
              const provider = providers.find((p) => p.code === c.provider);
              return (
                <Card key={c.id} className="bg-ink-800 border-white/10">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-base font-medium">{provider?.name ?? c.provider}</span>
                          <Badge variant="outline" className="text-[10px] border-white/10 capitalize">{c.status}</Badge>
                          {provider?.isDemo && <Badge variant="outline" className="text-[10px] border-violet-400/30 text-violet-400">DEMO</Badge>}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {c.lastSyncAt ? (
                            <>Last sync {new Date(c.lastSyncAt).toLocaleString()} · {c.syncCount} sync{c.syncCount !== 1 ? "s" : ""}</>
                          ) : (
                            <span className="text-warning-500">Never synced — click Sync to import transactions</span>
                          )}
                        </div>
                        {c.lastSyncError && (
                          <div className="text-[11px] text-danger-500 mt-1 flex items-center gap-1">
                            <AlertCircle size={10} /> {c.lastSyncError}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => sync(c.id)}
                          disabled={syncingId === c.id || c.status === "revoked"}
                          variant="outline"
                          className="border-white/10"
                        >
                          <RefreshCw size={12} className={syncingId === c.id ? "mr-1.5 animate-spin" : "mr-1.5"} />
                          {syncingId === c.id ? "Syncing…" : "Sync now"}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-danger-500 hover:text-danger-500">
                              <Trash2 size={12} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-ink-900 border-white/10 text-paper-100">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-display">Revoke connection?</AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-300">
                                This revokes consent. No new syncs will occur. Existing imported transactions are retained per data retention policy.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => revoke(c.id)}
                                className="bg-danger-500 text-white hover:bg-danger-500/90"
                              >
                                Revoke
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Consent sheet */}
      <Sheet open={!!connectingProvider} onOpenChange={(o) => !o && setConnectingProvider(null)}>
        <SheetContent className="bg-ink-900 border-white/10 text-paper-100 w-full sm:max-w-md">
          {connectingProvider && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display">Connect {connectingProvider.name}</SheetTitle>
                <SheetDescription className="text-slate-300">
                  Review the consent and confirm to connect.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="rounded-lg p-4 bg-ink-850 border border-white/5 space-y-2">
                  <div className="text-xs text-slate-400">Provider</div>
                  <div className="text-sm font-medium">{connectingProvider.name}</div>
                  <div className="text-xs text-slate-400 mt-2">{connectingProvider.description}</div>
                </div>

                <div className="rounded-lg p-4 bg-ink-850 border border-white/5">
                  <div className="text-xs text-slate-400 mb-2">Consent scope</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 size={12} className="text-mint-400" />
                      <span>Read transactions (90 days default)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 size={12} className="text-mint-400" />
                      <span>Read account list</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <ShieldIcon size={12} />
                      <span>Credentials encrypted at rest</span>
                    </div>
                  </div>
                </div>

                {connectingProvider.isDemo && (
                  <div className="rounded-lg p-3 bg-violet-400/10 border border-violet-400/30 text-xs text-slate-300">
                    <strong className="text-violet-400">Demo provider.</strong> This returns clearly-labelled synthetic test data. No real bank account is accessed.
                  </div>
                )}

                <label className="flex items-start gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>I grant consent for {connectingProvider.name} to read transaction data on my behalf. I can revoke at any time.</span>
                </label>

                <Button
                  onClick={connect}
                  disabled={!consentAccepted || connecting}
                  className="w-full bg-lime-400 text-ink-950 hover:bg-lime-400/90"
                >
                  {connecting ? "Connecting…" : `Connect ${connectingProvider.name}`}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
