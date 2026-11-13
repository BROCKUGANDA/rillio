"use client";

/**
 * Command palette (⌘K / "/") — keyboard-first navigation across views,
 * quick actions and notifications. Pure client component; actions are
 * dispatched to the parent shell.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Home, ListChecks, Plug, LogOut, Search, Settings, ShieldCheck, Target, Wallet, CornerDownLeft } from "lucide-react";

export type PaletteItem = {
  id: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
};

export function CommandPalette({
  open,
  onOpenChange,
  items,
  currentView,
  onNavigate,
  onSignOut,
  unread,
  onOpenNotifications,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: PaletteItem[];
  currentView: string;
  onNavigate: (v: string) => void;
  onSignOut: () => void;
  unread: number;
  onOpenNotifications: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const actions = useMemo(
    () => [
      { id: "__notifications", label: "Notifications", hint: unread > 0 ? `${unread} unread` : "All caught up", icon: <Bell size={16} /> },
    ],
    [unread],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = [...actions, ...items];
    if (!q) return pool;
    return pool.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(q));
  }, [query, items, actions]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Clamp the active index whenever the filtered list changes shape.
  const safeIdx = Math.min(activeIdx, Math.max(0, filtered.length - 1));

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${safeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [safeIdx]);

  function run(item: { id: string }) {
    close();
    if (item.id === "__notifications") {
      onOpenNotifications();
      return;
    }
    if (item.id === "__signout") {
      onSignOut();
      return;
    }
    onNavigate(item.id);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(Math.min(safeIdx + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(Math.max(safeIdx - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[safeIdx]) run(filtered[safeIdx]);
    } else if (e.key === "Escape") {
      close();
    }
  }

  /** Reset state and close — a fresh palette every open. */
  function close() {
    setQuery("");
    setActiveIdx(0);
    onOpenChange(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={close} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative w-full max-w-lg rounded-xl border border-white/10 bg-ink-850 shadow-2xl shadow-black/50 overflow-hidden"
            role="dialog"
            aria-label="Command palette"
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-2.5 px-4 border-b border-white/5">
              <Search size={15} className="text-slate-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to a view or run an action…"
                className="w-full h-12 bg-transparent text-sm text-paper-100 placeholder:text-slate-500 outline-none"
                aria-label="Command search"
              />
              <kbd className="font-mono text-[10px] text-slate-500 px-1.5 py-0.5 rounded bg-ink-900 border border-white/10">esc</kbd>
            </div>
            <div ref={listRef} className="max-h-72 overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No matches.</p>
              ) : (
                filtered.map((item, idx) => (
                  <button
                    key={item.id}
                    data-idx={idx}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => run(item)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      idx === safeIdx ? "bg-ink-700/70 text-paper-100" : "text-slate-300 hover:bg-ink-800"
                    }`}
                  >
                    <span className={idx === safeIdx ? "text-lime-400" : "text-slate-500"}>{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    <span className="text-[11px] text-slate-500">{item.hint}</span>
                    {idx === safeIdx && <CornerDownLeft size={13} className="text-slate-500" />}
                  </button>
                ))
              )}
            </div>
            <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
              <span>↑↓ navigate · ↵ select · / opens anywhere</span>
              <span>Rillio command palette</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const paletteIcons = { Bell, Home, ListChecks, Plug, Settings, ShieldCheck, Target, Wallet, LogOut };
