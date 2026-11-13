"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RillioMark } from "@/components/rillio/icons";
import { ShieldIcon, PulseIcon, GoalIcon, OrbitIcon } from "@/components/rillio/icons";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";

export function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { email, password };
      if (mode === "register") {
        payload.displayName = displayName;
        payload.baseCurrency = baseCurrency;
      }
      await apiFetch(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success(mode === "login" ? "Welcome back." : "Account created.");
      onAuthed();
    } catch (e) {
      const err = e as Error & { detail?: string };
      toast.error(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left: hero */}
      <div className="lg:flex-1 relative overflow-hidden p-8 lg:p-16 flex flex-col justify-between">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-0 w-[60%] h-[60%] rounded-full opacity-30 blur-3xl"
               style={{ background: "radial-gradient(circle, #62E0B5 0%, transparent 70%)" }} />
          <div className="absolute bottom-0 right-0 w-[50%] h-[50%] rounded-full opacity-20 blur-3xl"
               style={{ background: "radial-gradient(circle, #9B8AFB 0%, transparent 70%)" }} />
        </div>

        <div className="flex items-center gap-3">
          <RillioMark size={36} />
          <div>
            <div className="font-display font-semibold text-xl tracking-[0.18em] text-paper-100">RILLIO</div>
            <div className="text-xs text-slate-300 -mt-0.5">Small habits. Stronger financial futures.</div>
          </div>
        </div>

        <div className="max-w-xl my-12 lg:my-0">
          <h1 className="font-display text-4xl lg:text-5xl font-semibold leading-tight text-paper-100">
            Where your money habits meet <span className="text-gradient-brand">a clearer future.</span>
          </h1>
          <p className="mt-5 text-slate-300 text-base lg:text-lg leading-relaxed">
            Import real transactions. See where money goes. Plan goals honestly.
            Connect a read-only Solana wallet to see what you own — without ever
            giving up your keys.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 max-w-md">
            <FeatureCard icon={<PulseIcon />} title="Cash flow insight" body="Deterministic categories you can correct and trust." />
            <FeatureCard icon={<GoalIcon />} title="Honest goals" body="Plans, never pretend custody. No fake yields." />
            <FeatureCard icon={<OrbitIcon />} title="Read-only ownership" body="Solana portfolio visibility with provenance." />
            <FeatureCard icon={<ShieldIcon />} title="Privacy by default" body="Export and deletion built in. Your data, your call." />
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Working codename. Not legal or investment advice. Read-only MVP — no custody, transfers, or trades.
        </div>
      </div>

      {/* Right: auth form */}
      <div className="lg:w-[480px] p-6 lg:p-12 flex items-center justify-center bg-ink-900/60 backdrop-blur-sm border-l border-white/5">
        <Card className="w-full max-w-sm bg-ink-800 border-white/10">
          <CardHeader>
            <CardTitle className="font-display text-xl">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </CardTitle>
            <CardDescription className="text-slate-300">
              {mode === "login"
                ? "Sign in to continue your financial progress."
                : "Start with one workspace. No credit card required."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Alex"
                    className="bg-ink-850 border-white/10"
                    autoComplete="name"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="bg-ink-850 border-white/10"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={mode === "register" ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-ink-850 border-white/10"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                {mode === "register" && (
                  <p className="text-xs text-slate-500">Use at least 8 characters.</p>
                )}
              </div>
              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="baseCurrency">Base currency</Label>
                  <select
                    id="baseCurrency"
                    value={baseCurrency}
                    onChange={(e) => setBaseCurrency(e.target.value)}
                    className="w-full h-9 rounded-md bg-ink-850 border border-white/10 px-3 text-sm"
                  >
                    {["USD", "EUR", "GBP", "KES", "NGN", "ZAR", "UGX", "RWF", "JPY", "AUD", "CAD", "CHF", "CNY", "INR"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-lime-400 text-ink-950 hover:bg-lime-400/90 font-medium"
              >
                {loading ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <Separator className="my-5 bg-white/10" />

            <div className="text-center text-sm text-slate-300">
              {mode === "login" ? "New to Rillio?" : "Already have an account?"}{" "}
              <button
                type="button"
                className="text-mint-400 hover:underline font-medium"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Create one" : "Sign in"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl p-3 bg-ink-800/60 border border-white/5">
      <div className="text-mint-400 mb-1.5">{icon}</div>
      <div className="text-sm font-medium text-paper-100">{title}</div>
      <div className="text-xs text-slate-400 mt-0.5 leading-snug">{body}</div>
    </div>
  );
}
