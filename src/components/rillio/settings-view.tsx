"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { ShieldIcon, SourceIcon } from "@/components/rillio/icons";
import { Download, Trash2, LogOut, User } from "lucide-react";

type ExportRequest = { id: string; status: string; requestedAt: string; completedAt: string | null; artifactUrl: string | null };
type DeletionRequest = { id: string; status: string; requestedAt: string };

export function SettingsView({
  user,
  onSignOut,
}: {
  user: { id: string; email: string; displayName: string | null; baseCurrency: string; locale: string; timezone: string };
  onSignOut: () => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [baseCurrency, setBaseCurrency] = useState(user.baseCurrency);
  const [saving, setSaving] = useState(false);
  const [exportRequests, setExportRequests] = useState<ExportRequest[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [lastExport, setLastExport] = useState<unknown>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<{ requests: ExportRequest[] }>("/api/me/data-export"),
      apiFetch<{ requests: DeletionRequest[] }>("/api/me/deletion-request"),
    ]).then(([e, d]) => {
      setExportRequests(e.requests);
      setDeletionRequests(d.requests);
    }).catch(() => {});
  }, []);

  async function savePreferences() {
    setSaving(true);
    try {
      await apiFetch("/api/me/preferences", {
        method: "PATCH",
        body: JSON.stringify({ displayName, baseCurrency }),
      });
      toast.success("Preferences saved.");
    } catch (e) {
      toast.error("Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  }

  async function requestExport() {
    setExportLoading(true);
    try {
      const res = await apiFetch<{ request: ExportRequest; export: unknown }>("/api/me/data-export", { method: "POST" });
      toast.success("Data export ready.");
      setLastExport(res.export);
      const refreshed = await apiFetch<{ requests: ExportRequest[] }>("/api/me/data-export");
      setExportRequests(refreshed.requests);
    } catch (e) {
      toast.error("Export failed.");
    } finally {
      setExportLoading(false);
    }
  }

  async function requestDeletion() {
    try {
      const res = await apiFetch<{ request: DeletionRequest }>("/api/me/deletion-request", { method: "POST" });
      toast.warning("Deletion scheduled.", { description: "Your account is now marked deletion_pending. You will be signed out." });
      const refreshed = await apiFetch<{ requests: DeletionRequest[] }>("/api/me/deletion-request");
      setDeletionRequests(refreshed.requests);
      setTimeout(() => onSignOut(), 1500);
    } catch (e) {
      toast.error("Deletion request failed.");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Your data, your call. Privacy controls and account preferences.
        </p>
      </div>

      {/* Profile */}
      <Card className="bg-ink-800 border-white/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><User size={16} /> Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="display">Display name</Label>
            <Input id="display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-ink-850 border-white/10" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cur">Base currency</Label>
            <select
              id="cur"
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="w-full h-9 rounded-md bg-ink-850 border border-white/10 px-3 text-sm"
            >
              {["USD", "EUR", "GBP", "KES", "NGN", "ZAR", "UGX", "RWF", "JPY", "AUD", "CAD", "CHF", "CNY", "INR"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500">Used for cash-flow summaries and goal projections.</p>
          </div>
          <div>
            <Label className="text-xs text-slate-400">Email</Label>
            <div className="text-sm text-slate-300 mt-1">{user.email}</div>
          </div>
          <Button onClick={savePreferences} disabled={saving} className="bg-lime-400 text-ink-950 hover:bg-lime-400/90">
            {saving ? "Saving…" : "Save preferences"}
          </Button>
        </CardContent>
      </Card>

      {/* Privacy & data */}
      <Card className="bg-ink-800 border-white/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldIcon size={16} className="text-mint-400" /> Privacy & data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg p-4 bg-ink-850 border border-white/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium flex items-center gap-2"><Download size={14} /> Export your data</div>
                <p className="text-xs text-slate-400 mt-1">
                  Download a copy of your transactions, goals, wallets and categories. Includes source provenance.
                </p>
              </div>
              <Button onClick={requestExport} disabled={exportLoading} variant="outline" className="border-white/10">
                {exportLoading ? "Building…" : "Request export"}
              </Button>
            </div>
            {exportRequests.length > 0 && (
              <div className="mt-3 text-xs space-y-1">
                {exportRequests.slice(0, 3).map((r) => (
                  <div key={r.id} className="flex items-center justify-between">
                    <span className="text-slate-400">
                      {new Date(r.requestedAt).toLocaleString()}
                    </span>
                    <Badge variant="outline" className="text-[10px] border-white/10 capitalize">{r.status}</Badge>
                  </div>
                ))}
              </div>
            )}
            {lastExport != null && (
              <details className="mt-3">
                <summary className="text-xs text-mint-400 cursor-pointer">Preview export JSON</summary>
                <pre className="mt-2 p-2 bg-ink-950 rounded text-[10px] overflow-x-auto max-h-40 font-mono text-slate-300">
                  {JSON.stringify(lastExport, null, 2)}
                </pre>
              </details>
            )}
          </div>

          <div className="rounded-lg p-4 bg-ink-850 border border-danger-500/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium flex items-center gap-2 text-danger-500"><Trash2 size={14} /> Delete your account</div>
                <p className="text-xs text-slate-400 mt-1">
                  Schedules your account for deletion. Sessions are revoked immediately. You have 30 days to cancel via support.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="border-danger-500/30 text-danger-500 hover:text-danger-500">Delete</Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-ink-900 border-white/10 text-paper-100">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display">Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-300">
                      This will mark your account for deletion and sign you out immediately. We retain data for 30 days in case you change your mind, then hard-delete. This action cannot be undone after the grace period.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={requestDeletion}
                      className="bg-danger-500 text-white hover:bg-danger-500/90"
                    >
                      Schedule deletion
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            {deletionRequests.length > 0 && (
              <div className="mt-3 text-xs text-slate-400">
                Existing request: <Badge variant="outline" className="text-[10px] border-warning-500/30 text-warning-500 capitalize ml-1">{deletionRequests[0].status}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="bg-ink-800 border-white/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><SourceIcon size={16} /> Session</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={onSignOut} variant="outline" className="border-white/10">
            <LogOut size={14} className="mr-1.5" /> Sign out of Rillio
          </Button>
        </CardContent>
      </Card>

      {/* Billing boundary */}
      <Card className="bg-ink-800 border-white/10">
        <CardHeader>
          <CardTitle className="text-base">Billing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg p-3 bg-ink-850 border border-white/5 text-xs text-slate-300">
            <div className="font-medium text-slate-300 mb-1">Solana-native payments</div>
            <p className="text-slate-400">
              Plans are paid in USDC or native SOL on Solana. Entitlements are granted only after server-side onchain verification of the transfer — a browser redirect never unlocks features. Manage your plan in the Billing view.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <div className="text-xs text-slate-500 leading-relaxed">
        Rillio is a working codename. Not legal, investment, or regulatory advice. Read-only MVP — no custody, transfers, or trading. Regulated financial activities remain gated pending jurisdiction-specific review and qualified partners.
      </div>
    </div>
  );
}
