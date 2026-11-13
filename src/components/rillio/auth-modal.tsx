"use client";

/**
 * Auth modal — sheet-based sign-in / registration flow.
 * Shown over the landing page when the user clicks Get started / Sign in.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { RillioMark } from "@/components/rillio/icons";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, FileText, ArrowRight } from "lucide-react";

export function AuthModal({
  open,
  onOpenChange,
  onAuthed,
  mode: initialMode = "register",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAuthed: () => void;
  mode?: "login" | "register";
}) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "done">("form");

  // Reset internal step when the dialog opens, and sync the mode prop. Both are
  // applied outside the effect body to avoid a synchronous cascading render.
  useEffect(() => {
    if (open) queueMicrotask(() => setStep("form"));
  }, [open]);

  useEffect(() => {
    queueMicrotask(() => setMode(initialMode));
  }, [initialMode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { email, password };
      if (mode === "register") {
        payload.displayName = displayName || undefined;
        payload.baseCurrency = baseCurrency;
      }
      await apiFetch(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setStep("done");
      toast.success(mode === "login" ? "Welcome back." : "Account created.");
      setTimeout(() => {
        onAuthed();
        onOpenChange(false);
      }, 550);
    } catch (e) {
      const err = e as Error & { detail?: string };
      toast.error(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-ink-900 border-white/10 text-paper-100 w-full sm:max-w-md overflow-y-auto p-0"
      >
        <div className="relative min-h-full flex flex-col">
          {/* Ambient glow */}
          <div className="absolute inset-x-0 top-0 h-56 pointer-events-none overflow-hidden">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-56 rounded-full blur-3xl opacity-40"
                 style={{ background: "radial-gradient(circle, rgba(98,224,181,0.35), transparent 70%)" }} />
          </div>

          <SheetHeader className="relative p-6 pb-0">
            <div className="flex items-center gap-3">
              <RillioMark size={34} />
              <div>
                <SheetTitle className="font-display text-lg">
                  {step === "done" ? "You're in" : mode === "login" ? "Welcome back" : "Create your workspace"}
                </SheetTitle>
                <SheetDescription className="text-slate-400 text-xs">
                  {step === "done"
                    ? "Loading your dashboard…"
                    : mode === "login"
                    ? "Sign in to continue your financial progress."
                    : "One workspace. No credit card. Keys stay yours."}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="relative flex-1 p-6">
            <AnimatePresence mode="wait">
              {step === "done" ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-16 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.1 }}
                    className="mx-auto w-16 h-16 rounded-full gradient-brand flex items-center justify-center"
                  >
                    <ArrowRight size={26} className="text-ink-950" />
                  </motion.div>
                  <p className="mt-4 text-sm text-slate-300">Taking you to your Money Pulse…</p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={submit}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  {mode === "register" && (
                    <div className="space-y-2">
                      <Label htmlFor="m-name">Display name</Label>
                      <Input
                        id="m-name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Alex"
                        className="bg-ink-850 border-white/10"
                        autoComplete="name"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="m-email">Email</Label>
                    <Input
                      id="m-email"
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
                    <Label htmlFor="m-password">Password</Label>
                    <Input
                      id="m-password"
                      type="password"
                      required
                      minLength={mode === "register" ? 8 : 1}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-ink-850 border-white/10"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                    />
                    {mode === "register" && <p className="text-xs text-slate-500">Use at least 8 characters.</p>}
                  </div>
                  {mode === "register" && (
                    <div className="space-y-2">
                      <Label htmlFor="m-currency">Base currency</Label>
                      <select
                        id="m-currency"
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
                    className="w-full h-11 bg-lime-400 text-ink-950 hover:bg-lime-400/90 font-semibold rounded-xl"
                  >
                    {loading ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
                  </Button>

                  <Separator className="bg-white/10" />

                  <div className="text-center text-sm text-slate-400">
                    {mode === "login" ? "New to Rillio?" : "Already have a workspace?"}{" "}
                    <button
                      type="button"
                      className="text-mint-400 hover:underline font-medium"
                      onClick={() => setMode(mode === "login" ? "register" : "login")}
                    >
                      {mode === "login" ? "Create one" : "Sign in"}
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
                    <div className="rounded-lg bg-ink-850 border border-white/5 p-2 text-center">
                      <Shield size={12} className="mx-auto text-mint-400 mb-1" /> Non-custodial
                    </div>
                    <div className="rounded-lg bg-ink-850 border border-white/5 p-2 text-center">
                      <Lock size={12} className="mx-auto text-mint-400 mb-1" /> Encrypted
                    </div>
                    <div className="rounded-lg bg-ink-850 border border-white/5 p-2 text-center">
                      <FileText size={12} className="mx-auto text-mint-400 mb-1" /> Exportable
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
