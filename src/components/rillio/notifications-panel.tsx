"use client";

/**
 * Notifications drawer — slide-over panel listing the user's notifications
 * with mark-as-read (individual + mark-all). Reads via /api/notifications.
 */

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { Bell, BellOff, CheckCheck, X } from "lucide-react";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

function typeAccent(type: string): string {
  if (type.includes("import")) return "text-aqua-400 border-aqua-400/30 bg-aqua-400/10";
  if (type.includes("payment") || type.includes("billing")) return "text-lime-400 border-lime-400/30 bg-lime-400/10";
  if (type.includes("wallet") || type.includes("chain")) return "text-violet-400 border-violet-400/30 bg-violet-400/10";
  if (type.includes("connection")) return "text-mint-400 border-mint-400/30 bg-mint-400/10";
  return "text-slate-300 border-white/10 bg-white/5";
}

export function NotificationsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ notifications: NotificationRow[]; unreadCount: number }>("/api/notifications");
      setItems(res.notifications);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function markRead(id: string) {
    try {
      await apiFetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ id }) });
      setItems((prev) => (prev ?? []).map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    } catch {
      toast.error("Could not mark as read.");
    }
  }

  async function markAll() {
    try {
      await apiFetch("/api/notifications", { method: "PATCH", body: JSON.stringify({ markAll: true }) });
      setItems((prev) => (prev ?? []).map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      toast.success("All notifications marked read.");
    } catch {
      toast.error("Could not mark all as read.");
    }
  }

  const unread = (items ?? []).filter((n) => !n.readAt).length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
          <motion.aside
            initial={{ x: 360 }}
            animate={{ x: 0 }}
            exit={{ x: 360 }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-ink-900 border-l border-white/10 flex flex-col"
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-lime-400" />
                <span className="text-sm font-medium">Notifications</span>
                {unread > 0 && <Badge className="text-[10px] bg-lime-400/15 text-lime-400 border border-lime-400/30">{unread} new</Badge>}
              </div>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAll} className="h-8 text-xs text-slate-300 gap-1.5">
                    <CheckCheck size={13} /> Mark all
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} aria-label="Close" className="h-8 w-8 p-0 text-slate-400">
                  <X size={15} />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="space-y-2 p-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 bg-ink-850" />)}</div>
              ) : !items || items.length === 0 ? (
                <div className="text-center py-16">
                  <BellOff size={24} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-sm text-slate-400">Nothing here yet.</p>
                  <p className="text-xs text-slate-500 mt-1 px-6">Import completions, sync results and payment verifications will appear here.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {items.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      title={n.readAt ? "Read" : "Mark as read"}
                      className={`w-full text-left rounded-lg p-3 border transition-colors ${
                        n.readAt ? "border-white/5 bg-ink-850/50 opacity-70" : "border-white/10 bg-ink-850 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${typeAccent(n.type)}`}>
                          {n.type.replace(/_/g, " ")}
                        </span>
                        {!n.readAt && <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />}
                        <span className="ml-auto text-[10px] text-slate-500 num">
                          {new Date(n.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="text-sm text-paper-100">{n.title}</div>
                      {n.body && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{n.body}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
