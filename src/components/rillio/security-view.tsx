"use client";

/**
 * Trust & Security view — the enterprise-audit surface.
 *
 * Four sections: security posture (posture cards + live subsystem health),
 * append-only audit trail with filters, device/session management with
 * remote revoke, and the dated consent ledger. Plus the data-lifecycle
 * status (export / deletion requests).
 *
 * Everything here is read-your-own-data: scope is always the session user.
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ScrollText,
  MonitorSmartphone,
  FileClock,
  Database,
  RefreshCw,
  LogOut,
  Download,
  Trash2,
  Activity,
  Lock,
  Server,
  Search,
  ChevronDown,
} from "lucide-react";

/* ------------------------------- API types ------------------------------- */

type AuditEvent = {
  id: string;
  action: string;
  actor: string;
  resourceType: string;
  resourceId: string | null;
  reason: string | null;
  requestId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type AuditResponse = {
  events: AuditEvent[];
  nextCursor: string | null;
  hasMore: boolean;
  summary: {
    total: number;
    counts: Record<string, number>;
    lastEventAt: string | null;
    window: string;
  };
};

type SessionRow = {
  id: string;
  deviceInfo: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  expired: boolean;
  current: boolean;
};

type ConsentRow = {
  id: string;
  provider: string;
  scope: string;
  policyVersion: string;
  grantedAt: string;
  revokedAt: string | null;
  active: boolean;
};

type HealthResponse = {
  status: string;
  version: string;
  uptimeSec: number;
  subsystems: { name: string; status: string; detail: string; latencyMs?: number; observedAt: string }[];
  boundaries: Record<string, string>;
};

type LifecycleState = {
  exports: { id: string; status: string; requestedAt: string }[];
  deletions: { id: string; status: string; requestedAt: string }[];
};

const GROUPS = [
  { id: "all", label: "All" },
  { id: "auth", label: "Auth" },
  { id: "data", label: "Data" },
  { id: "connections", label: "Connections" },
  { id: "wallets", label: "Wallets" },
  { id: "billing", label: "Billing" },
  { id: "goals", label: "Goals" },
] as const;

function actionLabel(action: string): string {
  return action.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function groupColor(action: string): string {
  if (action.startsWith("auth.")) return "text-aqua-400 border-aqua-400/30 bg-aqua-400/10";
  if (action.startsWith("wallet.")) return "text-violet-400 border-violet-400/30 bg-violet-400/10";
  if (action.startsWith("billing.") || action.startsWith("payment.")) return "text-lime-400 border-lime-400/30 bg-lime-400/10";
  if (action.startsWith("connection.") || action.startsWith("consent.")) return "text-mint-400 border-mint-400/30 bg-mint-400/10";
  if (action.includes("failed") || action.includes("revok") || action.includes("deletion")) return "text-danger-500 border-danger-500/30 bg-danger-500/10";
  return "text-slate-300 border-white/10 bg-white/5";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function SecurityView({ user }: { user: { id: string; email: string } }) {
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [auditLoading, setAuditLoading] = useState(true);
  const [group, setGroup] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const [consents, setConsents] = useState<ConsentRow[]>([]);
  const [consentsLoading, setConsentsLoading] = useState(true);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const [lifecycle, setLifecycle] = useState<LifecycleState>({ exports: [], deletions: [] });

  const loadAudit = useCallback(async (g: string, q: string, cursor?: string) => {
    const params = new URLSearchParams();
    if (g && g !== "all") params.set("group", g);
    if (q) params.set("q", q);
    if (cursor) params.set("cursor", cursor);
    const res = await apiFetch<AuditResponse>(`/api/security/audit?${params.toString()}`);
    setAudit((prev) => {
      if (cursor && prev) {
        return { ...res, events: [...prev.events, ...res.events] };
      }
      return res;
    });
  }, []);

  useEffect(() => {
    setAuditLoading(true);
    loadAudit(group, query)
      .catch(() => toast.error("Failed to load audit trail."))
      .finally(() => setAuditLoading(false));
  }, [group, query, loadAudit]);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await apiFetch<{ sessions: SessionRow[] }>("/api/security/sessions");
      setSessions(res.sessions);
    } catch {
      toast.error("Failed to load sessions.");
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const loadConsents = useCallback(async () => {
    setConsentsLoading(true);
    try {
      const res = await apiFetch<{ consents: ConsentRow[] }>("/api/security/consents");
      setConsents(res.consents);
    } catch {
      toast.error("Failed to load consents.");
    } finally {
      setConsentsLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await apiFetch<HealthResponse>("/api/health?detail=1");
      setHealth(res);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadConsents();
    loadHealth();
    Promise.all([
      apiFetch<{ requests: LifecycleState["exports"] }>("/api/me/data-export"),
      apiFetch<{ requests: LifecycleState["deletions"] }>("/api/me/deletion-request"),
    ])
      .then(([e, d]) => setLifecycle({ exports: e.requests, deletions: d.requests }))
      .catch(() => {});
  }, [loadSessions, loadConsents, loadHealth]);

  async function revokeSession(id: string) {
    try {
      await apiFetch(`/api/security/sessions/${id}`, { method: "DELETE" });
      toast.success("Session revoked.", { description: "That device will be signed out on its next request." });
      loadSessions();
    } catch {
      toast.error("Revoke failed.");
    }
  }

  async function revokeOthers() {
    try {
      const res = await apiFetch<{ revoked: number }>("/api/security/sessions", {
        method: "POST",
        body: JSON.stringify({ action: "revoke-others" }),
      });
      toast.success(`Revoked ${res.revoked} other session${res.revoked === 1 ? "" : "s"}.`, {
        description: "This device stays signed in.",
      });
      loadSessions();
    } catch {
      toast.error("Revoke failed.");
    }
  }

  async function revokeConsent(id: string) {
    try {
      await apiFetch("/api/security/consents", {
        method: "PATCH",
        body: JSON.stringify({ consentId: id, action: "revoke" }),
      });
      toast.success("Consent withdrawn.", { description: "The withdrawal is recorded in your audit trail." });
      loadConsents();
    } catch {
      toast.error("Revoke failed.");
    }
  }

  async function loadMore() {
    if (!audit?.nextCursor) return;
    setLoadingMore(true);
    try {
      await loadAudit(group, query, audit.nextCursor);
    } catch {
      toast.error("Failed to load more events.");
    } finally {
      setLoadingMore(false);
    }
  }

  const activeSessions = sessions.filter((s) => !s.revokedAt && !s.expired).length;
  const activeConsents = consents.filter((c) => c.active).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Trust &amp; Security</h1>
          <p className="text-sm text-slate-400 mt-1">
            Your account&apos;s control plane — audit trail, devices, consents and live system health.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadHealth} className="border-white/10 gap-1.5">
          <RefreshCw size={13} className={healthLoading ? "animate-spin" : ""} /> Re-check systems
        </Button>
      </div>

      {/* Posture strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <PostureCard
          icon={<Lock size={15} />}
          label="Custody"
          value="None"
          detail="Read-only MVP. Rillio never holds, moves or trades your funds."
          accent="text-lime-400"
        />
        <PostureCard
          icon={<ScrollText size={15} />}
          label="Audit events"
          value={audit ? String(audit.summary.total) : "—"}
          detail={audit?.summary.lastEventAt ? `Last event ${timeAgo(audit.summary.lastEventAt)}` : "No events yet"}
          accent="text-mint-400"
        />
        <PostureCard
          icon={<MonitorSmartphone size={15} />}
          label="Active sessions"
          value={sessionsLoading ? "—" : String(activeSessions)}
          detail={sessionsLoading ? "Loading…" : "You can revoke any device remotely"}
          accent="text-aqua-400"
        />
        <PostureCard
          icon={<FileClock size={15} />}
          label="Active consents"
          value={consentsLoading ? "—" : String(activeConsents)}
          detail="Dated, versioned, revocable"
          accent="text-violet-400"
        />
      </div>

      {/* Live subsystem health */}
      <Card className="bg-ink-800 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity size={16} className="text-mint-400" /> System health
            <Badge
              variant="outline"
              className={`ml-auto text-[10px] uppercase tracking-wider ${
                health?.status === "ok"
                  ? "border-lime-400/40 text-lime-400 bg-lime-400/10"
                  : "border-warning-500/40 text-warning-500 bg-warning-500/10"
              }`}
            >
              {healthLoading ? "checking…" : health?.status ?? "unreachable"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 bg-ink-850" />
              <Skeleton className="h-12 bg-ink-850" />
              <Skeleton className="h-12 bg-ink-850" />
            </div>
          ) : health ? (
            <div className="grid gap-2 md:grid-cols-3">
              {health.subsystems.map((s) => (
                <div key={s.name} className="rounded-lg border border-white/5 bg-ink-850 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize flex items-center gap-1.5">
                      {s.name === "database" ? <Database size={13} className="text-slate-400" /> : s.name === "solana-rpc" ? <Server size={13} className="text-slate-400" /> : <Activity size={13} className="text-slate-400" />}
                      {s.name.replace("-", " ")}
                    </span>
                    <StatusDot status={s.status} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{s.detail}</p>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                    <span>{s.latencyMs !== undefined ? `${s.latencyMs}ms` : "—"}</span>
                    <span>{timeAgo(s.observedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Health probe unavailable — the API may be restarting.</p>
          )}
          {health?.boundaries && (
            <div className="mt-3 rounded-lg border border-white/5 bg-ink-950/60 p-3 grid gap-1.5 text-[11px] text-slate-400">
              {Object.entries(health.boundaries).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-slate-500 capitalize min-w-24">{k.replace(/([A-Z])/g, " $1").trim()}:</span>
                  <span className="text-slate-300">{v}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs: audit trail / sessions / consents / data lifecycle */}
      <Tabs defaultValue="audit" className="w-full">
        <TabsList className="bg-ink-850 border border-white/5 h-auto p-1 flex-wrap">
          <TabsTrigger value="audit" className="data-[state=active]:bg-ink-700 gap-1.5 text-xs"><ScrollText size={13} /> Audit trail</TabsTrigger>
          <TabsTrigger value="sessions" className="data-[state=active]:bg-ink-700 gap-1.5 text-xs"><MonitorSmartphone size={13} /> Devices</TabsTrigger>
          <TabsTrigger value="consents" className="data-[state=active]:bg-ink-700 gap-1.5 text-xs"><FileClock size={13} /> Consents</TabsTrigger>
          <TabsTrigger value="lifecycle" className="data-[state=active]:bg-ink-700 gap-1.5 text-xs"><Download size={13} /> Data lifecycle</TabsTrigger>
        </TabsList>

        {/* ------------------------- Audit trail ------------------------- */}
        <TabsContent value="audit" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGroup(g.id)}
                className={`px-3 py-1.5 rounded-full text-xs transition-all border ${
                  group === g.id
                    ? "bg-lime-400/15 border-lime-400/40 text-lime-400"
                    : "bg-ink-850 border-white/5 text-slate-400 hover:text-slate-300 hover:border-white/10"
                }`}
              >
                {g.label}
                {audit && g.id !== "all" && audit.summary.counts[g.id] > 0 && (
                  <span className="ml-1.5 text-[10px] opacity-70">{audit.summary.counts[g.id]}</span>
                )}
              </button>
            ))}
            <div className="relative ml-auto">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter actions…"
                className="h-8 w-44 pl-8 text-xs bg-ink-850 border-white/10"
              />
            </div>
          </div>

          <Card className="bg-ink-800 border-white/10">
            <CardContent className="p-0">
              {auditLoading ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 bg-ink-850" />)}
                </div>
              ) : !audit || audit.events.length === 0 ? (
                <div className="p-8 text-center">
                  <ScrollText size={22} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-sm text-slate-400">No audit events match this filter yet.</p>
                  <p className="text-xs text-slate-500 mt-1">Every sign-in, import, connection and payment verification lands here.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {audit.events.map((ev, i) => (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.25 }}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-ink-850/60 transition-colors"
                    >
                      <span className={`mt-0.5 shrink-0 inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${groupColor(ev.action)}`}>
                        {ev.action}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-paper-100">{actionLabel(ev.action)}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-x-3">
                          <span>actor: {ev.actor}</span>
                          <span>resource: {ev.resourceType}</span>
                          {ev.resourceId && <span className="font-mono">{ev.resourceId.slice(0, 12)}…</span>}
                          {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                            <span className="text-slate-400">{Object.entries(ev.metadata).slice(0, 2).map(([k, v]) => `${k}=${String(v).slice(0, 24)}`).join(" · ")}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-500 shrink-0 num">{timeAgo(ev.createdAt)}</span>
                    </motion.div>
                  ))}
                </div>
              )}
              {audit?.hasMore && (
                <div className="p-3 border-t border-white/5 text-center">
                  <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore} className="text-slate-300 gap-1.5">
                    {loadingMore ? "Loading…" : "Load more"} <ChevronDown size={14} />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock size={11} /> Append-only. Events survive account deletion for compliance forensics; user links are severed, records are not erased.
          </p>
        </TabsContent>

        {/* --------------------------- Sessions --------------------------- */}
        <TabsContent value="sessions" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Every signed-in device. Revoke anything you don&apos;t recognize.</p>
            {sessions.filter((s) => !s.current && !s.revokedAt && !s.expired).length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-danger-500/30 text-danger-500 hover:text-danger-500 hover:bg-danger-500/10 gap-1.5">
                    <LogOut size={13} /> Revoke other devices
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-ink-900 border-white/10">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display">Revoke all other devices?</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-300">
                      Every other signed-in device is signed out immediately. This device stays signed in. The action is recorded in your audit trail.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={revokeOthers} className="bg-danger-500 text-white hover:bg-danger-500/90">
                      Revoke {sessions.filter((s) => !s.current && !s.revokedAt && !s.expired).length} device(s)
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <Card className="bg-ink-800 border-white/10">
            <CardContent className="p-0">
              {sessionsLoading ? (
                <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 bg-ink-850" />)}</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {sessions.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <MonitorSmartphone size={16} className={s.current ? "text-lime-400" : "text-slate-500"} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-paper-100 flex items-center gap-2">
                          {s.deviceInfo}
                          {s.current && <Badge className="text-[9px] bg-lime-400/15 text-lime-400 border border-lime-400/30">THIS DEVICE</Badge>}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 num">
                          Created {new Date(s.createdAt).toLocaleDateString()} · Expires {new Date(s.expiresAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${
                        s.revokedAt ? "border-danger-500/30 text-danger-500" : s.expired ? "border-warning-500/30 text-warning-500" : "border-lime-400/30 text-lime-400"
                      }`}>
                        {s.revokedAt ? "revoked" : s.expired ? "expired" : "active"}
                      </Badge>
                      {!s.revokedAt && !s.expired && !s.current && (
                        <Button variant="ghost" size="sm" onClick={() => revokeSession(s.id)} className="text-slate-400 hover:text-danger-500 h-8">
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------------- Consents --------------------------- */}
        <TabsContent value="consents" className="mt-4 space-y-3">
          <p className="text-xs text-slate-400">
            Explicit, dated, versioned consent records. Withdrawing a consent never deletes the row — the withdrawal itself is part of the ledger.
          </p>
          <Card className="bg-ink-800 border-white/10">
            <CardContent className="p-0">
              {consentsLoading ? (
                <div className="p-4 space-y-3">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-12 bg-ink-850" />)}</div>
              ) : consents.length === 0 ? (
                <div className="p-8 text-center">
                  <FileClock size={22} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-sm text-slate-400">No consents yet.</p>
                  <p className="text-xs text-slate-500 mt-1">Connect a provider or wallet to create your first dated consent.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {consents.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-paper-100 capitalize">
                          {c.provider} <span className="text-slate-500">· {c.scope}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 num">
                          {c.policyVersion} · granted {new Date(c.grantedAt).toLocaleString()}
                          {c.revokedAt && ` · withdrawn ${new Date(c.revokedAt).toLocaleString()}`}
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${c.active ? "border-lime-400/30 text-lime-400" : "border-white/10 text-slate-500"}`}>
                        {c.active ? "active" : "withdrawn"}
                      </Badge>
                      {c.active && (
                        <Button variant="ghost" size="sm" onClick={() => revokeConsent(c.id)} className="text-slate-400 hover:text-danger-500 h-8">
                          Withdraw
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------ Data lifecycle ------------------------ */}
        <TabsContent value="lifecycle" className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="bg-ink-800 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Download size={14} className="text-mint-400" /> Exports</CardTitle>
              </CardHeader>
              <CardContent>
                {lifecycle.exports.length === 0 ? (
                  <p className="text-xs text-slate-500">No exports requested yet. Request one from Settings → Privacy &amp; data.</p>
                ) : (
                  <div className="space-y-2">
                    {lifecycle.exports.slice(0, 5).map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 num">{new Date(r.requestedAt).toLocaleString()}</span>
                        <Badge variant="outline" className="text-[10px] border-lime-400/30 text-lime-400">{r.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="bg-ink-800 border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Trash2 size={14} className="text-danger-500" /> Deletions</CardTitle>
              </CardHeader>
              <CardContent>
                {lifecycle.deletions.length === 0 ? (
                  <p className="text-xs text-slate-500">No deletion requests. Data retention: 30-day grace, then hard delete with audit-tombstones preserved.</p>
                ) : (
                  <div className="space-y-2">
                    {lifecycle.deletions.slice(0, 5).map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 num">{new Date(r.requestedAt).toLocaleString()}</span>
                        <Badge variant="outline" className="text-[10px] border-warning-500/30 text-warning-500">{r.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="rounded-lg border border-white/5 bg-ink-850 p-4 text-xs text-slate-400 leading-relaxed">
            <div className="flex items-center gap-2 text-slate-300 font-medium mb-1.5">
              <ShieldCheck size={14} className="text-lime-400" /> Enterprise posture commitments
            </div>
            <ul className="space-y-1 list-disc list-inside">
              <li>Rate limiting on every API bucket (auth 10/min, exports 6/min, mutations 60/min) with RFC 7807 429 responses and Retry-After.</li>
              <li>Security headers enforced at the edge: CSP, frame denial, nosniff, strict referrer, HSTS.</li>
              <li>Credentials for providers are AES-256-GCM encrypted at rest; session tokens are stored only as SHA-256 hashes.</li>
              <li>Money is BigInt minor units end-to-end — no float arithmetic anywhere in the ledger.</li>
              <li>Payment entitlements are granted only after server-side onchain verification — never from browser redirects.</li>
            </ul>
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-slate-500">Signed in as {user.email}. This page shows only your own data.</p>
    </div>
  );
}

function PostureCard({
  icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl border border-white/8 bg-ink-800/80 p-4 hover:border-white/15 transition-colors"
    >
      <div className={`flex items-center gap-1.5 text-xs ${accent}`}>
        {icon} <span className="uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="font-display text-2xl font-semibold mt-1.5 num">{value}</div>
      <p className="text-[11px] text-slate-500 mt-1 leading-snug">{detail}</p>
    </motion.div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === "ok" ? "bg-lime-400" : status === "degraded" ? "bg-warning-500" : "bg-danger-500";
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400">
      <span className={`w-2 h-2 rounded-full ${color} ${status !== "ok" ? "animate-pulse" : ""}`} />
      {status}
    </span>
  );
}
