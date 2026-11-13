"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch, type Session, type Counts, type PlanInfo } from "@/lib/api-client";
import { Landing } from "@/components/rillio/landing";
import { AuthModal } from "@/components/rillio/auth-modal";
import { HomeView } from "@/components/rillio/home-view";
import { ActivityView } from "@/components/rillio/activity-view";
import { GoalsView } from "@/components/rillio/goals-view";
import { PortfolioView } from "@/components/rillio/portfolio-view";
import { ConnectionsView } from "@/components/rillio/connections-view";
import { BillingView } from "@/components/rillio/billing-view";
import { SettingsView } from "@/components/rillio/settings-view";
import { SecurityView } from "@/components/rillio/security-view";
import { CommandPalette } from "@/components/rillio/command-palette";
import { NotificationsPanel } from "@/components/rillio/notifications-panel";
import { RillioMark, RillioWordmark } from "@/components/rillio/icons";
import {
  Home,
  ListChecks,
  Target,
  Wallet,
  Settings,
  LogOut,
  Bell,
  Menu,
  Plug,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Search, Command } from "lucide-react";

type View = "home" | "activity" | "goals" | "portfolio" | "connections" | "billing" | "security" | "settings";

const viewMotion = {
  initial: { opacity: 0, y: 14, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -8, filter: "blur(4px)" },
  transition: { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] as const },
};

export default function Page() {
  const [user, setUser] = useState<Session | null>(null);
  const [counts, setCounts] = useState<Counts>({ imports: 0, transactions: 0, goals: 0, wallets: 0 });
  const [plan, setPlan] = useState<PlanInfo>({ code: "free", name: "Free", status: "active", currentPeriodEnd: null });
  const [entitlements, setEntitlements] = useState<Record<string, string>>({});
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<View>("home");
  const [unread, setUnread] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const reduce = useReducedMotion();

  const refreshMe = useCallback(async () => {
    try {
      const res = await apiFetch<{ user: Session; counts: Counts; plan?: PlanInfo; entitlements?: Record<string, string> }>("/api/auth/me");
      setUser(res.user);
      setCounts(res.counts);
      setPlan(res.plan ?? { code: "free", name: "Free", status: "active", currentPeriodEnd: null });
      setEntitlements(res.entitlements ?? {});
    } catch {
      setUser(null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  // Deep-link query params (?view=billing&billing=return)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view");
    if (v && ["home", "activity", "goals", "portfolio", "connections", "billing", "security", "settings"].includes(v)) {
      setView(v as View);
      const billing = params.get("billing");
      if (billing === "return") {
        setTimeout(() => toast.info("Checkout complete. Verifying onchain payment…", { description: "Plus unlocks only after the server verifies the transfer." }), 500);
      } else if (billing === "cancelled") {
        toast.warning("Checkout cancelled.");
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ unreadCount: number }>("/api/notifications").then((r) => setUnread(r.unreadCount)).catch(() => {});
  }, [user]);

  // Command palette: ⌘K / Ctrl+K, or "/" when not typing in a field.
  useEffect(() => {
    if (!user) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === "/" && !paletteOpen) {
        const t = e.target as HTMLElement;
        if (t.tagName !== "INPUT" && t.tagName !== "TEXTAREA" && !t.isContentEditable) {
          e.preventDefault();
          setPaletteOpen(true);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user, paletteOpen]);

  async function signOut() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
    setView("home");
    toast.success("Signed out.");
  }

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RillioMark size={48} className="animate-pulse" />
          <div className="text-sm text-slate-400">Loading Rillio…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Landing
          onGetStarted={() => {
            setAuthMode("register");
            setAuthOpen(true);
          }}
          onSignIn={() => {
            setAuthMode("login");
            setAuthOpen(true);
          }}
        />
        <AuthModal
          open={authOpen}
          onOpenChange={setAuthOpen}
          onAuthed={refreshMe}
          mode={authMode}
        />
      </>
    );
  }

  const navItems: { id: View; label: string; icon: React.ReactNode; badge?: number; hint: string }[] = [
    { id: "home", label: "Home", icon: <Home size={18} />, hint: "Cash-flow overview & quick actions" },
    { id: "activity", label: "Activity", icon: <ListChecks size={18} />, badge: counts.transactions || undefined, hint: "Transactions, subscriptions & recurring" },
    { id: "goals", label: "Goals", icon: <Target size={18} />, badge: counts.goals || undefined, hint: "Savings targets & simulations" },
    { id: "portfolio", label: "Portfolio", icon: <Wallet size={18} />, badge: counts.wallets || undefined, hint: "Read-only Solana wallets" },
    { id: "connections", label: "Connections", icon: <Plug size={18} />, hint: "Bank & data providers" },
    { id: "billing", label: "Billing", icon: <CreditCard size={18} />, hint: "Plan, invoices & Solana payments" },
    { id: "security", label: "Security", icon: <ShieldCheck size={18} />, hint: "Audit trail, devices & consents" },
    { id: "settings", label: "Settings", icon: <Settings size={18} />, hint: "Profile, privacy & data controls" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex w-64 flex-col bg-ink-900 border-r border-white/5 sticky top-0 h-screen">
        <div className="p-5">
          <RillioWordmark size={26} />
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((n) => (
            <NavButton
              key={n.id}
              active={view === n.id}
              label={n.label}
              icon={n.icon}
              badge={n.badge}
              hint={n.hint}
              onClick={() => setView(n.id)}
            />
          ))}
        </nav>
        <div className="p-3 border-t border-white/5">
          <button
            onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 mb-1 rounded-lg text-xs text-slate-400 bg-ink-850/60 border border-white/5 hover:border-white/15 hover:text-slate-300 transition-colors"
          >
            <span className="flex items-center gap-2"><Command size={13} /> Quick actions</span>
            <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-ink-900 border border-white/10">⌘K</kbd>
          </button>
          <div className="px-2 py-2 text-xs">
            <div className="text-slate-300 truncate">{user.displayName || user.email}</div>
            <div className="text-slate-500 truncate text-[11px]">{user.email}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-slate-300 hover:text-paper-100">
            <LogOut size={14} className="mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-ink-900 border-b border-white/5 px-4 h-14 flex items-center justify-between">
        <RillioWordmark size={22} />
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="text-slate-300 p-2"
          aria-label="Menu"
        >
          <Menu size={20} />
        </button>
      </div>
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            className="lg:hidden fixed inset-0 z-40 bg-ink-950/80 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute right-0 top-0 bottom-0 w-64 bg-ink-900 border-l border-white/5 p-4"
              onClick={(e) => e.stopPropagation()}
              initial={{ x: 280 }}
              animate={{ x: 0 }}
              exit={{ x: 280 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
            >
              <div className="mt-14 space-y-1">
                {navItems.map((n) => (
                  <NavButton
                    key={n.id}
                    active={view === n.id}
                    label={n.label}
                    icon={n.icon}
                    badge={n.badge}
                    onClick={() => { setView(n.id); setMobileNavOpen(false); }}
                  />
                ))}
                <div className="border-t border-white/5 my-3" />
                <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-slate-300">
                  <LogOut size={14} className="mr-2" /> Sign out
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-white/5 bg-ink-900/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="text-sm text-slate-400">
            <span className="text-slate-300">{user.displayName || "Rillio member"}</span> · {user.baseCurrency}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden xl:flex items-center gap-2 text-xs text-slate-500 bg-ink-850/60 border border-white/5 rounded-lg px-3 py-1.5 hover:border-white/15 hover:text-slate-300 transition-colors"
            >
              <Search size={13} /> Search &amp; commands
              <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-ink-900 border border-white/10">⌘K</kbd>
            </button>
            <button
              onClick={() => setNotifOpen(true)}
              className="relative text-slate-400 hover:text-paper-100 p-2"
              aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-lime-400 text-ink-950 text-[10px] flex items-center justify-center font-bold">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={reduce ? { opacity: 0 } : viewMotion.initial}
              animate={reduce ? { opacity: 1 } : viewMotion.animate}
              exit={reduce ? { opacity: 0 } : viewMotion.exit}
              transition={viewMotion.transition}
            >
              {view === "home" && <HomeView user={user} onNavigate={(v) => setView(v as View)} />}
              {view === "activity" && <ActivityView user={user} entitlements={entitlements} />}
              {view === "goals" && <GoalsView user={user} />}
              {view === "portfolio" && <PortfolioView user={user} />}
              {view === "connections" && <ConnectionsView onNavigate={(v) => setView(v as View)} />}
              {view === "billing" && <BillingView plan={plan} onRefresh={refreshMe} />}
              {view === "security" && <SecurityView user={user} />}
              {view === "settings" && <SettingsView user={user} onSignOut={signOut} />}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="mt-auto border-t border-white/5 py-4 px-8 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>Rillio · Small habits. Stronger financial futures.</span>
          <span className="text-[10px]">Working codename · Not legal or investment advice · Read-only MVP</span>
        </footer>
      </main>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={navItems.map((n) => ({ id: n.id, label: n.label, hint: n.hint, icon: n.icon }))}
        currentView={view}
        onNavigate={(v) => setView(v as View)}
        onSignOut={signOut}
        unread={unread}
        onOpenNotifications={() => setNotifOpen(true)}
      />

      <NotificationsPanel
        open={notifOpen}
        onOpenChange={(o) => {
          setNotifOpen(o);
          if (!o) setUnread(0);
        }}
      />
    </div>
  );
}

function NavButton({
  active,
  label,
  icon,
  badge,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={hint}
      className={`group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
        active
          ? "bg-ink-800 text-paper-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          : "text-slate-300 hover:bg-ink-800/50 hover:text-paper-100"
      }`}
    >
      {active && (
        <motion.span
          layoutId="nav-active-bar"
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-lime-400"
        />
      )}
      <span className={active ? "text-lime-400" : "text-slate-400 group-hover:text-slate-300 transition-colors"}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge variant="outline" className="text-[10px] border-white/10 text-slate-300">
          {badge}
        </Badge>
      )}
    </button>
  );
}
