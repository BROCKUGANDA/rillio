"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { formatMinor, parseDecimalToMinor } from "@/lib/money";
import { GoalIcon } from "@/components/rillio/icons";
import { toast } from "sonner";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { Target, Calendar, Pause, Archive, TrendingUp } from "lucide-react";

type Goal = {
  id: string;
  name: string;
  targetMinor: string;
  currency: string;
  startingAmountMinor: string;
  plannedContributionMinor: string;
  contributionCadence: string;
  status: string;
  targetDate: string | null;
  notes: string | null;
  events: { id: string; type: string; createdAt: string; metadata: string | null }[];
};

export function GoalsView({ user }: { user: { baseCurrency: string } }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);

  // Create form
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [startingAmount, setStartingAmount] = useState("0");
  const [contribution, setContribution] = useState("");
  const [cadence, setCadence] = useState<"weekly" | "biweekly" | "monthly">("monthly");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  // Simulation
  const [sim, setSim] = useState<{
    goalId: string;
    targetMinor: string;
    projectedAmountMinor: string;
    reachesTarget: boolean;
    shortfallMinor: string;
    months: number;
    schedule: { month: number; contribution: string; projected: string; label: string }[];
    assumedReturnRate: number | null;
    warning: string;
    disclaimer: string;
  } | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [assumedReturn, setAssumedReturn] = useState("0");

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ goals: Goal[] }>("/api/goals");
      setGoals(res.goals);
    } catch (e) {
      toast.error("Failed to load goals.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createGoal(e: React.FormEvent) {
    e.preventDefault();
    const targetMinor = parseDecimalToMinor(targetAmount, user.baseCurrency);
    if (!targetMinor) {
      toast.error("Enter a valid target amount.");
      return;
    }
    const planned = parseDecimalToMinor(contribution, user.baseCurrency) ?? 0n;
    const starting = parseDecimalToMinor(startingAmount, user.baseCurrency) ?? 0n;
    setCreating(true);
    try {
      await apiFetch("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          name,
          targetMinor: targetMinor.toString(),
          currency: user.baseCurrency,
          startingAmountMinor: starting.toString(),
          plannedContributionMinor: planned.toString(),
          contributionCadence: cadence,
          targetDate: targetDate ? new Date(targetDate).toISOString() : null,
          notes: notes || undefined,
        }),
      });
      toast.success("Goal created.");
      setCreateOpen(false);
      setName(""); setTargetAmount(""); setContribution(""); setNotes(""); setTargetDate("");
      load();
    } catch (e) {
      const err = e as Error;
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function simulate(goalId: string) {
    setSimLoading(true);
    try {
      const rate = parseFloat(assumedReturn) || 0;
      const res = await apiFetch(`/api/goals/${goalId}/simulate`, {
        method: "POST",
        body: JSON.stringify({ assumedReturnRate: rate > 0 ? rate / 100 : undefined }),
      });
      setSim(res);
    } catch (e) {
      toast.error("Simulation failed.");
    } finally {
      setSimLoading(false);
    }
  }

  async function pauseGoal(goalId: string) {
    try {
      await apiFetch(`/api/goals/${goalId}/pause`, { method: "POST" });
      toast.success("Goal paused.");
      load();
      if (selectedGoal?.id === goalId) setSelectedGoal(null);
    } catch (e) { toast.error("Failed to pause goal."); }
  }
  async function archiveGoal(goalId: string) {
    try {
      await apiFetch(`/api/goals/${goalId}/archive`, { method: "POST" });
      toast.success("Goal archived.");
      load();
      if (selectedGoal?.id === goalId) setSelectedGoal(null);
    } catch (e) { toast.error("Failed to archive goal."); }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Give money a direction</h1>
          <p className="text-sm text-slate-400 mt-1">
            Goals are plans, not held funds. Rillio does not custody money.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-lime-400 text-ink-950 hover:bg-lime-400/90">
          <Target size={16} className="mr-1.5" /> New goal
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 bg-ink-700 rounded-2xl" />)}
        </div>
      ) : goals.length === 0 ? (
        <Card className="bg-ink-800 border-white/10">
          <CardContent className="p-12 text-center">
            <GoalIcon size={40} className="mx-auto text-slate-500 mb-3" />
            <h3 className="text-sm font-medium text-paper-100">Give your next milestone a name.</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Whether it&apos;s a buffer, a trip, or a first investment — give it a target and a cadence. We&apos;ll project honestly.
            </p>
            <Button onClick={() => setCreateOpen(true)} className="mt-4 bg-lime-400 text-ink-950 hover:bg-lime-400/90">
              Create your first goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((g) => {
            const target = BigInt(g.targetMinor);
            const starting = BigInt(g.startingAmountMinor);
            const pct = target > 0n ? Number((starting * 100n) / target) : 0;
            return (
              <Card
                key={g.id}
                className="bg-ink-800 border-white/10 hover:border-mint-400/30 cursor-pointer transition-colors"
                onClick={() => { setSelectedGoal(g); setSim(null); }}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-display text-base font-medium truncate">{g.name}</div>
                    <Badge variant="outline" className="text-[10px] border-white/10 text-slate-300 capitalize">{g.status}</Badge>
                  </div>
                  <div className="num text-xs text-slate-400 mt-1">
                    {formatMinor(starting, g.currency)} of {formatMinor(target, g.currency)}
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-ink-700 overflow-hidden">
                    <div className="h-full gradient-brand transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                    <span>{formatMinor(BigInt(g.plannedContributionMinor), g.currency)}/{g.contributionCadence.replace("bi", "bi-")}</span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {g.targetDate ? new Date(g.targetDate).toLocaleDateString() : "No date"}
                    </span>
                  </div>
                  <div className="mt-3 text-[10px] text-slate-500">
                    Planned allocation · Not held funds
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="bg-ink-900 border-white/10 text-paper-100 w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">Create a goal</SheetTitle>
            <SheetDescription className="text-slate-300">
              A plan, not a held balance. Projected deterministically, no assumed returns by default.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={createGoal} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="g-name">Goal name</Label>
              <Input id="g-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Emergency buffer" className="bg-ink-850 border-white/10" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="g-target">Target amount ({user.baseCurrency})</Label>
                <Input id="g-target" required value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="5000" inputMode="decimal" className="bg-ink-850 border-white/10 num" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-start">Starting amount</Label>
                <Input id="g-start" value={startingAmount} onChange={(e) => setStartingAmount(e.target.value)} placeholder="0" inputMode="decimal" className="bg-ink-850 border-white/10 num" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="g-contrib">Contribution</Label>
                <Input id="g-contrib" value={contribution} onChange={(e) => setContribution(e.target.value)} placeholder="200" inputMode="decimal" className="bg-ink-850 border-white/10 num" />
              </div>
              <div className="space-y-1.5">
                <Label>Cadence</Label>
                <Select value={cadence} onValueChange={(v: "weekly" | "biweekly" | "monthly") => setCadence(v)}>
                  <SelectTrigger className="bg-ink-850 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-ink-850 border-white/10">
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-date">Target date (optional)</Label>
              <Input id="g-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="bg-ink-850 border-white/10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-notes">Notes (optional)</Label>
              <Textarea id="g-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="What this goal is for…" className="bg-ink-850 border-white/10" />
            </div>
            <div className="rounded-lg p-3 bg-warning-500/10 border border-warning-500/30 text-xs text-slate-300">
              Goals are plans, not held funds. Rillio does not custody money in MVP.
            </div>
            <Button type="submit" disabled={creating} className="w-full bg-lime-400 text-ink-950 hover:bg-lime-400/90">
              {creating ? "Creating…" : "Create goal"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* Goal detail + simulate */}
      <Sheet open={!!selectedGoal} onOpenChange={(o) => !o && setSelectedGoal(null)}>
        <SheetContent className="bg-ink-900 border-white/10 text-paper-100 w-full sm:max-w-lg overflow-y-auto">
          {selectedGoal && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display">{selectedGoal.name}</SheetTitle>
                <SheetDescription className="text-slate-300">
                  {formatMinor(BigInt(selectedGoal.startingAmountMinor), selectedGoal.currency)} of {formatMinor(BigInt(selectedGoal.targetMinor), selectedGoal.currency)}
                  {selectedGoal.targetDate && <> · by {new Date(selectedGoal.targetDate).toLocaleDateString()}</>}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="h-3 rounded-full bg-ink-700 overflow-hidden">
                  <div className="h-full gradient-brand" style={{ width: `${Math.min(100, Number((BigInt(selectedGoal.startingAmountMinor) * 100n) / (BigInt(selectedGoal.targetMinor) || 1n)))}%` }} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg p-3 bg-ink-800 border border-white/5">
                    <div className="text-xs text-slate-400">Contribution</div>
                    <div className="num font-medium mt-0.5">
                      {formatMinor(BigInt(selectedGoal.plannedContributionMinor), selectedGoal.currency)}/{selectedGoal.contributionCadence}
                    </div>
                  </div>
                  <div className="rounded-lg p-3 bg-ink-800 border border-white/5">
                    <div className="text-xs text-slate-400">Status</div>
                    <div className="font-medium mt-0.5 capitalize">{selectedGoal.status}</div>
                  </div>
                </div>

                {selectedGoal.notes && (
                  <div className="rounded-lg p-3 bg-ink-850 border border-white/5 text-sm text-slate-300">
                    {selectedGoal.notes}
                  </div>
                )}

                {/* Simulation */}
                <div className="rounded-lg p-4 bg-ink-850 border border-white/5 space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-mint-400" />
                    <div className="text-sm font-medium">Scenario simulator</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-400">Assumed annual return (%)</Label>
                      <Input value={assumedReturn} onChange={(e) => setAssumedReturn(e.target.value)} placeholder="0" inputMode="decimal" className="bg-ink-800 border-white/10 num h-9" />
                    </div>
                    <Button onClick={() => simulate(selectedGoal.id)} disabled={simLoading} className="bg-mint-400 text-ink-950 hover:bg-mint-400/90 h-9">
                      {simLoading ? "Calculating…" : "Simulate"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Default scenario assumes no investment return. Optional assumed return is illustrative and not guaranteed.
                  </p>
                </div>

                {sim && (
                  <div className="space-y-3">
                    <div className={`rounded-lg p-3 border ${sim.reachesTarget ? "bg-success-500/10 border-success-500/30" : "bg-warning-500/10 border-warning-500/30"}`}>
                      <div className="text-xs text-slate-400">Projected</div>
                      <div className="num font-display text-xl font-semibold mt-0.5">
                        {formatMinor(BigInt(sim.projectedAmountMinor), selectedGoal.currency)}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {sim.reachesTarget
                          ? "Reaches target within the timeframe."
                          : `Short by ${formatMinor(BigInt(sim.shortfallMinor), selectedGoal.currency)} over ${sim.months} months.`}
                      </div>
                    </div>

                    {sim.schedule.length > 0 && (
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={sim.schedule.map((s) => ({ label: s.label, projected: Number(s.projected) / 100 }))}>
                            <XAxis dataKey="label" stroke="#73849A" fontSize={10} tickFormatter={(d) => String(d).slice(5)} />
                            <YAxis stroke="#73849A" fontSize={10} />
                            <Tooltip
                              contentStyle={{ background: "#111D2D", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }}
                              formatter={(v: number) => [v.toFixed(2), "Projected"]}
                            />
                            <ReferenceLine y={Number(sim.targetMinor) / 100} stroke="#C5F36A" strokeDasharray="4 4" label={{ value: "Target", fill: "#C5F36A", fontSize: 10 }} />
                            <Line type="monotone" dataKey="projected" stroke="#62E0B5" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {sim.assumedReturnRate && (
                      <div className="rounded-lg p-3 bg-warning-500/10 border border-warning-500/30 text-xs text-slate-300">
                        <strong className="text-warning-500">Illustrative scenario with assumed return.</strong>{" "}
                        {sim.warning}
                      </div>
                    )}

                    <div className="text-[11px] text-slate-500">{sim.disclaimer}</div>
                  </div>
                )}

                {/* History */}
                {selectedGoal.events.length > 0 && (
                  <div>
                    <Label className="text-xs text-slate-400">Activity</Label>
                    <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-white/10 bg-ink-850">
                      {selectedGoal.events.slice(0, 10).map((ev) => (
                        <div key={ev.id} className="px-3 py-2 text-xs border-b border-white/5 last:border-0">
                          <div className="flex justify-between">
                            <span className="text-slate-300 capitalize">{ev.type.replace(/_/g, " ")}</span>
                            <span className="text-slate-500">{new Date(ev.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedGoal.status === "active" && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 border-white/10" onClick={() => pauseGoal(selectedGoal.id)}>
                      <Pause size={14} className="mr-1.5" /> Pause
                    </Button>
                    <Button variant="outline" className="flex-1 border-white/10 text-danger-500 hover:text-danger-500" onClick={() => archiveGoal(selectedGoal.id)}>
                      <Archive size={14} className="mr-1.5" /> Archive
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
