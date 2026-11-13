"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch, type Session, type Counts } from "@/lib/api-client";
import { AuthScreen } from "@/components/rillio/auth-screen";
import { HomeView } from "@/components/rillio/home-view";
import { ActivityView } from "@/components/rillio/activity-view";
import { GoalsView } from "@/components/rillio/goals-view";
import { PortfolioView } from "@/components/rillio/portfolio-view";
import { SettingsView } from "@/components/rillio/settings-view";
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
} from "lucide-react";
import { toast } from "sonner";

type View = "home" | "activity" | "goals" | "portfolio" | "settings";

export default function Page() {
  const [user, setUser] = useState<Session | null>(null);
  const [counts, setCounts] = useState<Counts>({ imports: 0, transactions: 0, goals: 0, wallets: 0 });
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<View>("home");
  const [unread, setUnread] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const refreshMe = useCallback(async () => {
    try {
      const res = await apiFetch<{ user: Session; counts: Counts }>("/api/auth/me");
      setUser(res.user);
      setCounts(res.counts);
    } catch {
      setUser(null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ unreadCount: number }>("/api/notifications").then((r) => setUnread(r.unreadCount)).catch(() => {});
  }, [user]);

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
    return <AuthScreen onAuthed={refreshMe} />;
  }

  const navItems: { id: View; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "home", label: "Home", icon: <Home size={18} /> },
    { id: "activity", label: "Activity", icon: <ListChecks size={18} />, badge: counts.transactions || undefined },
    { id: "goals", label: "Goals", icon: <Target size={18} />, badge: counts.goals || undefined },
    { id: "portfolio", label: "Portfolio", icon: <Wallet size={18} />, badge: counts.wallets || undefined },
    { id: "settings", label: "Settings", icon: <Settings size={18} /> },
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
              onClick={() => setView(n.id)}
            />
          ))}
        </nav>
        <div className="p-3 border-t border-white/5">
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
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-ink-950/80 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-ink-900 border-l border-white/5 p-4" onClick={(e) => e.stopPropagation()}>
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
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar (desktop) */}
        <header className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-white/5 bg-ink-900/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="text-sm text-slate-400">
            <span className="text-slate-300">{user.displayName || "Rillio member"}</span> · {user.baseCurrency}
          </div>
          <div className="flex items-center gap-3">
            <button className="relative text-slate-400 hover:text-paper-100 p-2" aria-label="Notifications">
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
          {view === "home" && <HomeView user={user} onNavigate={(v) => setView(v as View)} />}
          {view === "activity" && <ActivityView user={user} />}
          {view === "goals" && <GoalsView user={user} />}
          {view === "portfolio" && <PortfolioView user={user} />}
          {view === "settings" && <SettingsView user={user} onSignOut={signOut} />}
        </div>

        <footer className="mt-auto border-t border-white/5 py-4 px-8 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>Rillio · Small habits. Stronger financial futures.</span>
          <span className="text-[10px]">Working codename · Not legal or investment advice · Read-only MVP</span>
        </footer>
      </main>
    </div>
  );
}

function NavButton({
  active,
  label,
  icon,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? "bg-ink-800 text-paper-100"
          : "text-slate-300 hover:bg-ink-800/50 hover:text-paper-100"
      }`}
    >
      <span className={active ? "text-lime-400" : "text-slate-400"}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge variant="outline" className="text-[10px] border-white/10 text-slate-300">
          {badge}
        </Badge>
      )}
    </button>
  );
}
