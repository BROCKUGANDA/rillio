"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, animate } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";
import { formatMinor, minorToChartNumber } from "@/lib/money";
import { PulseIcon, GoalIcon, OrbitIcon, FlowIcon, SparkIcon } from "@/components/rillio/icons";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type Summary = {
  totalTransactions: number;
  inflowMinor: string;
  outflowMinor: string;
  netMinor: string;
  currency: string;
  byCategory: { categoryId: string; name: string; kind: string; inflowMinor: string; outflowMinor: string; count: number }[];
  byDay: { date: string; inflow: number; outflow: number }[];
  recurring: { merchant: string; count: number; totalMinor: string }[];
};

type PortfolioSummary = {
  hasWallet: boolean;
  boundary: { kind: "ok" | "not_configured"; reason?: string; guidance?: string; cluster?: string };
  totalUsdMinor: string | null;
  pricedAssetCount: number;
  unpricedAssetCount: number;
  unverifiedAssetCount: number;
  snapshotAt: string;
  stale: boolean;
};

type GoalsResp = { goals: Array<{ id: string; name: string; targetMinor: string; currency: string; startingAmountMinor: string; plannedContributionMinor: string; contributionCadence: string; status: string; targetDate: string | null }> };

type Insights = {
  currency: string;
  topMerchants: { merchant: string; outflowMinor: string; txnCount: number; sharePct: number }[];
  burnRate: {
    trailing30dOutflowMinor: string;
    dailyBurnMinor: string;
    daysRemainingInMonth: number;
    projectedMonthOutflowMinor: string;
  };
  recurring: { items: { merchant: string; estimatedMonthlyMinor: string }[]; estimatedMonthlyTotalMinor: string };
};

const PIE_COLORS = ["#C5F36A", "#62E0B5", "#64CFE0", "#9B8AFB", "#F3B95F", "#39C98A", "#F16D79", "#AAB7C7", "#73849A"];

export function HomeView({
  user,
  onNavigate,
}: {
  user: { id: string; baseCurrency: string; displayName: string | null };
  onNavigate: (view: string) => void;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [goals, setGoals] = useState<GoalsResp["goals"] | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodMonths, setPeriodMonths] = useState(3);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - periodMonths, 1);
      try {
        const [s, p, g, ins] = await Promise.all([
          apiFetch<Summary>("/api/transactions", {
            method: "POST",
            body: JSON.stringify({
              periodStart: start.toISOString(),
              periodEnd: now.toISOString(),
            }),
          }),
          apiFetch<PortfolioSummary>("/api/portfolio/summary"),
          apiFetch<GoalsResp>("/api/goals"),
          apiFetch<Insights>("/api/insights").catch(() => null),
        ]);
        if (cancelled) return;
        setSummary(s);
        setPortfolio(p);
        setGoals(g.goals);
        if (ins) setInsights(ins);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [periodMonths]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const currency = user.baseCurrency;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-slate-300">
            {greeting}, {user.displayName || "there"}.
          </div>
          <h1 className="font-display text-3xl font-semibold mt-1">Your Money Pulse</h1>
          <p className="text-sm text-slate-400 mt-1">
            Last {periodMonths} months · {currency}
          </p>
        </div>
        <div className="flex gap-2">
          {[1, 3, 6, 12].map((m) => (
            <Button
              key={m}
              size="sm"
              variant={periodMonths === m ? "default" : "outline"}
              onClick={() => setPeriodMonths(m)}
              className={periodMonths === m ? "bg-lime-400 text-ink-950 hover:bg-lime-400/90" : "border-white/10"}
            >
              {m}M
            </Button>
          ))}
        </div>
      </div>

      {/* Top metrics row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard
          index={0}
          label="Inflow"
          value={summary ? formatMinor(BigInt(summary.inflowMinor), currency, { signed: false }) : null}
          icon={<FlowIcon />}
          tone="positive"
          loading={loading}
        />
        <MetricCard
          index={1}
          label="Outflow"
          value={summary ? formatMinor(BigInt(summary.outflowMinor), currency, { signed: false }) : null}
          icon={<FlowIcon className="rotate-180" />}
          tone="negative"
          loading={loading}
        />
        <MetricCard
          index={2}
          label="Net flow"
          value={summary ? formatMinor(BigInt(summary.netMinor), currency, { signed: true }) : null}
          icon={<PulseIcon />}
          tone={summary && BigInt(summary.netMinor) >= 0n ? "positive" : "negative"}
          loading={loading}
        />
        <MetricCard
          index={3}
          label="Transactions"
          value={summary ? String(summary.totalTransactions) : null}
          icon={<SparkIcon />}
          tone="neutral"
          loading={loading}
        />
      </div>

      {/* Insights strip — burn rate, recurring total, top merchant */}
      {insights && insights.burnRate && BigInt(insights.burnRate.trailing30dOutflowMinor) > 0n && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="grid gap-3 grid-cols-1 sm:grid-cols-3"
        >
          <button
            onClick={() => onNavigate("activity")}
            className="text-left rounded-xl border border-white/8 bg-ink-850/80 p-4 hover:border-mint-400/30 transition-colors group"
          >
            <div className="text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-mint-400 animate-pulse" /> Daily burn (30d)
            </div>
            <div className="font-display text-lg font-semibold num mt-1 text-paper-100">
              {formatMinor(BigInt(insights.burnRate.dailyBurnMinor), insights.currency)}
              <span className="text-[11px] text-slate-500 font-sans font-normal"> · projected {formatMinor(BigInt(insights.burnRate.projectedMonthOutflowMinor), insights.currency)}</span>
            </div>
          </button>
          <button
            onClick={() => onNavigate("activity")}
            className="text-left rounded-xl border border-white/8 bg-ink-850/80 p-4 hover:border-lime-400/30 transition-colors"
          >
            <div className="text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-400" /> Recurring detected
            </div>
            <div className="font-display text-lg font-semibold num mt-1 text-paper-100">
              {insights.recurring.items.length > 0
                ? `${formatMinor(BigInt(insights.recurring.estimatedMonthlyTotalMinor), insights.currency)}/mo`
                : "None found"}
              <span className="text-[11px] text-slate-500 font-sans font-normal"> · {insights.recurring.items.length} patterns</span>
            </div>
          </button>
          <button
            onClick={() => onNavigate("activity")}
            className="text-left rounded-xl border border-white/8 bg-ink-850/80 p-4 hover:border-violet-400/30 transition-colors"
          >
            <div className="text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Top merchant (90d)
            </div>
            <div className="font-display text-lg font-semibold num mt-1 text-paper-100 truncate">
              {insights.topMerchants[0] ? insights.topMerchants[0].merchant : "—"}
              {insights.topMerchants[0] && (
                <span className="text-[11px] text-slate-500 font-sans font-normal">
                  {" "}· {formatMinor(BigInt(insights.topMerchants[0].outflowMinor), insights.currency)}
                </span>
              )}
            </div>
          </button>
        </motion.div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Cash flow chart */}
        <Card className="lg:col-span-2 bg-ink-800 border-white/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PulseIcon size={18} className="text-mint-400" />
              Cash flow trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full bg-ink-700" />
            ) : summary && summary.byDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={summary.byDay}>
                  <defs>
                    <linearGradient id="inflowG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#62E0B5" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#62E0B5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outflowG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F16D79" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#F16D79" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    stroke="#73849A"
                    fontSize={11}
                    tickFormatter={(d) => d.slice(5)}
                  />
                  <YAxis stroke="#73849A" fontSize={11} tickFormatter={(v) => v.toFixed(0)} />
                  <Tooltip
                    contentStyle={{
                      background: "#111D2D",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "#AAB7C7" }}
                  />
                  <Area type="monotone" dataKey="inflow" stroke="#62E0B5" fill="url(#inflowG)" name="Inflow" strokeWidth={2} />
                  <Area type="monotone" dataKey="outflow" stroke="#F16D79" fill="url(#outflowG)" name="Outflow" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="Your money story starts here."
                body="Import a CSV from your bank or card statement to see your cash flow."
                action={<Button onClick={() => onNavigate("activity")} className="bg-lime-400 text-ink-950 hover:bg-lime-400/90">Import transactions</Button>}
              />
            )}
          </CardContent>
        </Card>

        {/* Spending map */}
        <Card className="bg-ink-800 border-white/10">
          <CardHeader>
            <CardTitle className="text-base">Spending map</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full bg-ink-700" />
            ) : summary && summary.byCategory.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={summary.byCategory.filter((c) => c.kind === "expense" && BigInt(c.outflowMinor) > 0n).map((c) => ({
                        name: c.name,
                        value: minorToChartNumber(BigInt(c.outflowMinor), currency),
                      }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {summary.byCategory.filter((c) => c.kind === "expense" && BigInt(c.outflowMinor) > 0n).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#080E19" strokeWidth={1.5} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#111D2D",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {summary.byCategory
                    .filter((c) => c.kind === "expense" && BigInt(c.outflowMinor) > 0n)
                    .sort((a, b) => Number(BigInt(b.outflowMinor) - BigInt(a.outflowMinor)))
                    .slice(0, 6)
                    .map((c, i) => (
                      <div key={c.categoryId} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-slate-300 truncate">{c.name}</span>
                        </div>
                        <span className="num text-paper-100 font-medium">{formatMinor(BigInt(c.outflowMinor), currency)}</span>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <EmptyState title="No spending yet" body="Import data to see your category breakdown." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Goals summary */}
        <Card className="bg-ink-800 border-white/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GoalIcon size={18} className="text-lime-400" />
              Your plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <Skeleton className="h-24 w-full bg-ink-700" />
            ) : goals && goals.length > 0 ? (
              goals.slice(0, 3).map((g) => {
                const pct = Number((BigInt(g.startingAmountMinor) * 100n) / (BigInt(g.targetMinor) || 1n));
                return (
                  <div key={g.id} className="rounded-lg p-3 bg-ink-850 border border-white/5">
                    <div className="flex justify-between items-start">
                      <div className="text-sm font-medium text-paper-100 truncate">{g.name}</div>
                      <Badge variant="outline" className="text-xs border-white/10 text-slate-300">{g.status}</Badge>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 num">
                      {formatMinor(BigInt(g.startingAmountMinor), g.currency)} of {formatMinor(BigInt(g.targetMinor), g.currency)}
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-ink-700 overflow-hidden">
                      <div className="h-full gradient-brand" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5">
                      Planned allocation. Not held funds.
                    </p>
                  </div>
                );
              })
            ) : (
              <EmptyState
                title="Give your next milestone a name."
                action={<Button size="sm" onClick={() => onNavigate("goals")} className="bg-lime-400 text-ink-950 hover:bg-lime-400/90">Create a goal</Button>}
              />
            )}
            {goals && goals.length > 0 && (
              <Button size="sm" variant="ghost" className="w-full text-mint-400" onClick={() => onNavigate("goals")}>
                View all goals →
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Portfolio summary */}
        <Card className="bg-ink-800 border-white/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <OrbitIcon size={18} className="text-violet-400" />
              Ownership
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full bg-ink-700" />
            ) : portfolio ? (
              <div className="space-y-3">
                {portfolio.boundary.kind === "not_configured" ? (
                  <BoundaryCard guidance={portfolio.boundary.guidance ?? "RPC not configured."} />
                ) : portfolio.hasWallet ? (
                  <>
                    <div className="text-sm text-slate-300">Total supported value</div>
                    <div className="font-display num text-2xl font-semibold text-paper-100">
                      {portfolio.totalUsdMinor ? formatMinor(BigInt(portfolio.totalUsdMinor), "USD") : "—"}
                    </div>
                    <div className="text-xs text-slate-400">Snapshot {new Date(portfolio.snapshotAt).toLocaleString()}</div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs border-white/10">{portfolio.pricedAssetCount} priced</Badge>
                      <Badge variant="outline" className="text-xs border-white/10">{portfolio.unpricedAssetCount} unpriced</Badge>
                      <Badge variant="outline" className="text-xs border-white/10">{portfolio.unverifiedAssetCount} unverified</Badge>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="No wallet connected"
                    body="Connect a wallet to view supported Solana assets. Rillio cannot access your private keys."
                    action={<Button size="sm" onClick={() => onNavigate("wallets")} className="bg-lime-400 text-ink-950 hover:bg-lime-400/90">Connect wallet</Button>}
                  />
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Recurring merchants */}
        <Card className="bg-ink-800 border-white/10">
          <CardHeader>
            <CardTitle className="text-base">Recurring activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full bg-ink-700" />
            ) : summary && summary.recurring.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {summary.recurring.map((r) => (
                  <div key={r.merchant} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <div className="text-paper-100 truncate capitalize">{r.merchant}</div>
                      <div className="text-xs text-slate-500">{r.count} occurrences</div>
                    </div>
                    <div className="num text-paper-100 font-medium">
                      {formatMinor(BigInt(r.totalMinor), currency)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No recurring patterns yet" body="More history will help us spot useful patterns." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const STAGGER = { duration: 0.5, ease: [0.2, 0.8, 0.2, 1] as const };

function MetricCard({
  label,
  value,
  icon,
  tone,
  loading,
  index = 0,
}: {
  label: string;
  value: string | null;
  icon: React.ReactNode;
  tone: "positive" | "negative" | "neutral";
  loading: boolean;
  index?: number;
}) {
  const colorClass =
    tone === "positive" ? "text-mint-400" : tone === "negative" ? "text-danger-500" : "text-paper-100";
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...STAGGER, delay: index * 0.07 }}
      whileHover={reduce ? undefined : { y: -3 }}
    >
      <Card className="bg-ink-800 border-white/10 h-full">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400">{label}</div>
            <div className={colorClass}>{icon}</div>
          </div>
          <div className={`num font-display text-2xl font-semibold mt-2 ${colorClass}`}>
            {loading ? <Skeleton className="h-7 w-24 bg-ink-700" /> : value ?? "—"}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-6">
      <div className="text-sm font-medium text-paper-100">{title}</div>
      {body && <p className="text-xs text-slate-400 mt-1">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function BoundaryCard({ guidance }: { guidance: string }) {
  return (
    <div className="rounded-lg p-3 bg-warning-500/10 border border-warning-500/30 text-xs text-slate-300">
      <div className="font-medium text-warning-500 mb-1">RPC not configured</div>
      <p className="leading-snug">{guidance}</p>
    </div>
  );
}
