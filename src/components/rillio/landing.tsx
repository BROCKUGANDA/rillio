"use client";

/**
 * Rillio landing — hard-style redesign.
 *
 * Structure:
 *   1. Aurora + particle-field canvas backdrop (devicePixelRatio aware)
 *   2. 3D hero: mouse-parallax tilt on a floating card stack + orbit rings
 *   3. Animated core-loop pipeline (moving dots along SVG paths)
 *   4. Bento feature grid with internal micro-visualizations
 *   5. Enterprise / security section with a live audit-stream mock
 *   6. Solana-native payments rail
 *   7. Pricing (Free / Plus — Solana payments only), FAQ, footer
 *
 * Honors prefers-reduced-motion: canvas freezes, heavy motion collapses to
 * fades. All figures are illustrative product mocks, clearly labeled.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useInView,
  useReducedMotion,
  useScroll,
  AnimatePresence,
} from "framer-motion";
import {
  RillioMark,
  RillioWordmark,
  PulseIcon,
  GoalIcon,
  OrbitIcon,
  FlowIcon,
  ShieldIcon,
  SourceIcon,
  SparkIcon,
} from "@/components/rillio/icons";
import {
  ArrowRight,
  CheckCircle2,
  Shield,
  Lock,
  FileText,
  Coins,
  Zap,
  ChevronDown,
  Globe,
  Cpu,
  RefreshCw,
  ScrollText,
  MonitorSmartphone,
  KeyRound,
  BadgeCheck,
  CircleAlert,
  Menu,
  X,
} from "lucide-react";

const EASE = [0.2, 0.8, 0.2, 1] as const;

/* ---------------------------------- utils ---------------------------------- */

function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : y, filter: reduce ? "blur(0px)" : "blur(6px)" }}
      animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Section eyebrow tag — small uppercase kicker with brand dot. */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
      <span className="w-1.5 h-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(197,243,106,0.8)]" />
      {children}
    </div>
  );
}

/* --------------------------- particle field canvas -------------------------- */

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type P = { x: number; y: number; vx: number; vy: number; r: number; hue: number; alpha: number };
    let parts: P[] = [];

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(90, Math.floor((rect.width * rect.height) / 22000));
      parts = Array.from({ length: count }, () => ({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.6 + 0.6,
        hue: Math.random() > 0.6 ? 96 : Math.random() > 0.5 ? 160 : 262, // lime | mint | violet
        alpha: Math.random() * 0.5 + 0.2,
      }));
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const HUES: Record<number, string> = { 96: "#C5F36A", 160: "#62E0B5", 262: "#9B8AFB" };

    function tick() {
      if (!running) return;
      const rect = canvas!.getBoundingClientRect();
      ctx!.clearRect(0, 0, rect.width, rect.height);

      // connections
      for (let i = 0; i < parts.length; i++) {
        const a = parts[i];
        for (let j = i + 1; j < parts.length; j++) {
          const b = parts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 13000) {
            const alpha = (1 - d2 / 13000) * 0.14;
            ctx!.strokeStyle = `rgba(197,243,106,${alpha})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }
      // particles
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = rect.width + 10;
        if (p.x > rect.width + 10) p.x = -10;
        if (p.y < -10) p.y = rect.height + 10;
        if (p.y > rect.height + 10) p.y = -10;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = HUES[p.hue];
        ctx!.globalAlpha = p.alpha;
        ctx!.fill();
        ctx!.globalAlpha = 1;
      }
      raf = requestAnimationFrame(tick);
    }

    if (!reduce) {
      raf = requestAnimationFrame(tick);
    } else {
      // static single frame
      tick();
      running = false;
      cancelAnimationFrame(raf);
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reduce]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" aria-hidden="true" />;
}

/* ------------------------------ aurora backdrop ----------------------------- */

function Aurora() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <motion.div
        className="absolute -top-40 left-1/4 w-[720px] h-[720px] rounded-full opacity-30 blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(98,224,181,0.5), transparent 65%)" }}
        animate={{ x: [0, 60, -20, 0], y: [0, 30, 50, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-20 -right-40 w-[640px] h-[640px] rounded-full opacity-25 blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(155,138,251,0.5), transparent 65%)" }}
        animate={{ x: [0, -50, 20, 0], y: [0, 40, -20, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 -left-40 w-[560px] h-[560px] rounded-full opacity-20 blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(197,243,106,0.45), transparent 65%)" }}
        animate={{ x: [0, 40, -30, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/* ------------------------------ 3D hero cards ------------------------------- */

type HeroCard = {
  id: string;
  label: string;
  value: string;
  sub: string;
  accent: string;
  glyph: React.ReactNode;
  pos: { x: number; y: number; z: number; rotate: number };
};

const HERO_CARDS: HeroCard[] = [
  {
    id: "net",
    label: "Net cash flow · 3M",
    value: "+$2,480.11",
    sub: "Inflow $9,120 · Outflow $6,640",
    accent: "text-mint-400",
    glyph: <PulseIcon size={18} className="text-mint-400" />,
    pos: { x: -12, y: 6, z: 40, rotate: -3.5 },
  },
  {
    id: "goal",
    label: "Goal · Emergency fund",
    value: "68% funded",
    sub: "Planned allocation — not held funds",
    accent: "text-lime-400",
    glyph: <GoalIcon size={18} className="text-lime-400" />,
    pos: { x: 16, y: 30, z: 24, rotate: 2.5 },
  },
  {
    id: "wallet",
    label: "Solana wallet · verified",
    value: "65.75 SOL",
    sub: "Read-only · keys never leave you",
    accent: "text-violet-400",
    glyph: <OrbitIcon size={18} className="text-violet-400" />,
    pos: { x: -18, y: 52, z: 12, rotate: -2 },
  },
];

function HeroCardStack() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 120, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 120, damping: 18 });
  const reduce = useReducedMotion();

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reduce) return;
      const rect = e.currentTarget.getBoundingClientRect();
      mx.set((e.clientX - rect.left) / rect.width - 0.5);
      my.set((e.clientY - rect.top) / rect.height - 0.5);
    },
    [mx, my, reduce],
  );

  return (
    <div
      className="relative h-[420px] w-full max-w-[520px] [perspective:1400px] select-none"
      onMouseMove={onMove}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
      aria-label="Illustrative Rillio dashboard cards"
    >
      {/* orbit rings */}
      <motion.div
        className="absolute inset-0 m-auto w-[460px] h-[460px] rounded-full border border-lime-400/10"
        style={{ transformStyle: "preserve-3d" }}
        animate={reduce ? {} : { rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      >
        <span className="absolute -top-1 left-1/2 -ml-1.5 w-3 h-3 rounded-full bg-lime-400 shadow-[0_0_16px_rgba(197,243,106,0.9)]" />
      </motion.div>
      <motion.div
        className="absolute inset-0 m-auto w-[330px] h-[330px] rounded-full border border-mint-400/10"
        style={{ transformStyle: "preserve-3d" }}
        animate={reduce ? {} : { rotate: -360 }}
        transition={{ duration: 44, repeat: Infinity, ease: "linear" }}
      >
        <span className="absolute top-1/2 -right-1.5 -mt-1.5 w-3 h-3 rounded-full bg-mint-400 shadow-[0_0_16px_rgba(98,224,181,0.9)]" />
      </motion.div>

      <motion.div
        className="absolute inset-0 [transform-style:preserve-3d]"
        style={reduce ? {} : { rotateX: rx, rotateY: ry }}
      >
        {/* glow core */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-lime-400/10 blur-[90px]" />

        {HERO_CARDS.map((c, i) => (
          <motion.div
            key={c.id}
            className="absolute left-1/2 top-1/2 w-[290px]"
            style={{ transformStyle: "preserve-3d" }}
            initial={{ opacity: 0, y: 30, z: c.pos.z }}
            animate={{ opacity: 1, y: c.pos.y, x: c.pos.x, rotate: c.pos.rotate, z: c.pos.z }}
            transition={{ delay: 0.35 + i * 0.16, duration: 0.9, ease: EASE }}
          >
            <motion.div
              whileHover={{ scale: 1.04, rotate: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 20 }}
              className="rounded-2xl border border-white/10 bg-ink-850/90 backdrop-blur-md p-4 shadow-2xl shadow-black/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-2">{c.glyph} {c.label}</span>
                <BadgeCheck size={14} className="text-slate-600" />
              </div>
              <div className={`num font-display text-2xl font-semibold mt-2 ${c.accent}`}>{c.value}</div>
              <div className="text-[11px] text-slate-500 mt-1">{c.sub}</div>
              {c.id === "goal" && (
                <div className="mt-3 h-1.5 rounded-full bg-ink-700 overflow-hidden">
                  <motion.div
                    className="h-full gradient-brand"
                    initial={{ width: "0%" }}
                    animate={{ width: "68%" }}
                    transition={{ delay: 1.1, duration: 1.4, ease: EASE }}
                  />
                </div>
              )}
              {c.id === "wallet" && (
                <div className="mt-3 flex gap-1.5 flex-wrap">
                  {["SOL", "USDC", "JUP", "+22"].map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-md bg-ink-700/80 border border-white/5 text-slate-300">{t}</span>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

/* ------------------------------- landing shell ------------------------------ */

export function Landing({
  onGetStarted,
  onSignIn,
}: {
  onGetStarted: () => void;
  onSignIn: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.15]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setMobileOpen(false);
  };

  return (
    <div className="relative min-h-screen bg-ink-950 text-paper-100 overflow-x-clip">
      {/* =============================== NAV =============================== */}
      <header className="fixed top-0 inset-x-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/8 bg-ink-950/70 backdrop-blur-xl px-4 py-2.5 shadow-lg shadow-black/30">
            <RillioWordmark size={24} />
            <nav className="hidden md:flex items-center gap-1 text-sm text-slate-300">
              {[
                ["flow", "How it works"],
                ["features", "Features"],
                ["security", "Security"],
                ["payments", "Payments"],
                ["pricing", "Pricing"],
              ].map(([id, label]) => (
                <button key={id} onClick={() => scrollTo(id)} className="px-3 py-1.5 rounded-lg hover:bg-white/5 hover:text-paper-100 transition-colors">
                  {label}
                </button>
              ))}
            </nav>
            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onSignIn} className="text-slate-300 hover:text-paper-100">
                Sign in
              </Button>
              <Button size="sm" onClick={onGetStarted} className="bg-lime-400 text-ink-950 hover:bg-lime-300 font-semibold">
                Get started <ArrowRight size={15} className="ml-1" />
              </Button>
            </div>
            <button className="md:hidden text-slate-300 p-1.5" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div className="fixed inset-0 z-50 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink-950/90 backdrop-blur-md" onClick={() => setMobileOpen(false)} />
            <motion.div
              className="absolute top-4 inset-x-4 rounded-2xl border border-white/10 bg-ink-900 p-4"
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-3">
                <RillioWordmark size={22} />
                <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-slate-400 p-1"><X size={18} /></button>
              </div>
              <div className="flex flex-col">
                {[["flow", "How it works"], ["features", "Features"], ["security", "Security"], ["payments", "Payments"], ["pricing", "Pricing"]].map(([id, label]) => (
                  <button key={id} onClick={() => scrollTo(id)} className="text-left px-3 py-2.5 rounded-lg text-slate-200 hover:bg-white/5">
                    {label}
                  </button>
                ))}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Button variant="outline" onClick={onSignIn} className="border-white/10">Sign in</Button>
                  <Button onClick={onGetStarted} className="bg-lime-400 text-ink-950 hover:bg-lime-300">Get started</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =============================== HERO =============================== */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-28 pb-16">
        <Aurora />
        <ParticleField />
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 grid lg:grid-cols-2 gap-10 items-center w-full">
          <div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
              <Kicker>Personal finance · Solana-native · read-only</Kicker>
            </motion.div>

            <motion.h1
              className="font-display text-5xl sm:text-6xl xl:text-7xl font-semibold tracking-tight leading-[1.02] mt-4"
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.08, ease: EASE }}
            >
              {["Know where", "every cent", "flows."].map((word, i) => (
                <span key={word} className="inline-block overflow-hidden mr-[0.28em] align-bottom">
                  <motion.span
                    className={`inline-block ${i === 2 ? "text-gradient-brand" : ""}`}
                    initial={{ y: "110%" }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.75, delay: 0.12 + i * 0.09, ease: EASE }}
                  >
                    {word}
                  </motion.span>
                </span>
              ))}
            </motion.h1>

            <motion.p
              className="mt-5 text-lg text-slate-300 max-w-xl leading-relaxed"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.34, ease: EASE }}
            >
              Import your statements, watch spending categorize itself, plan goals without handing anyone your money,
              and read your Solana portfolio — all with an enterprise-grade audit trail behind every action.
            </motion.p>

            <motion.div
              className="mt-8 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.44, ease: EASE }}
            >
              <Button size="lg" onClick={onGetStarted} className="bg-lime-400 text-ink-950 hover:bg-lime-300 font-semibold text-base h-12 px-6 shadow-[0_8px_30px_rgba(197,243,106,0.25)]">
                Start free — no card needed <ArrowRight size={17} className="ml-1.5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => scrollTo("flow")} className="border-white/15 text-base h-12 px-6 hover:bg-white/5">
                See the core loop <ChevronDown size={16} className="ml-1" />
              </Button>
            </motion.div>

            <motion.div
              className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              {([
                ["Lock", "No custody — ever"],
                ["Shield", "AES-256-GCM credentials"],
                ["ScrollText", "Append-only audit trail"],
                ["Zap", "Onchain-verified billing"],
              ] as const).map(([icon, label]) => {
                const map = { Lock, Shield, ScrollText, Zap } as const;
                const I = map[icon];
                return (
                  <span key={label} className="inline-flex items-center gap-1.5">
                    <I size={13} className="text-mint-400" /> {label}
                  </span>
                );
              })}
            </motion.div>
          </div>

          <motion.div
            className="hidden lg:flex justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <HeroCardStack />
          </motion.div>
        </motion.div>

        {/* scroll hint */}
        <motion.button
          onClick={() => scrollTo("flow")}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-slate-500 hover:text-slate-300 z-10"
          animate={reduce ? {} : { y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          aria-label="Scroll to core loop"
        >
          <ChevronDown size={22} />
        </motion.button>
      </section>
      {/* ============================ CORE LOOP ============================ */}
      <CoreLoopSection />

      {/* ============================ FEATURES ============================= */}
      <FeaturesSection />

      {/* ============================ SECURITY ============================= */}
      <SecuritySection />

      {/* ============================ PAYMENTS ============================= */}
      <PaymentsSection />

      {/* ============================= PRICING ============================= */}
      <PricingSection onGetStarted={onGetStarted} />

      {/* =============================== FAQ =============================== */}
      <FaqSection onGetStarted={onGetStarted} />

      {/* ============================== FOOTER ============================= */}
      <footer className="border-t border-white/5 mt-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <RillioWordmark size={24} />
              <p className="text-xs text-slate-500 mt-2 max-w-md leading-relaxed">
                Rillio is a working codename. Not legal, investment or regulatory advice. Read-only MVP: no custody,
                no transfers, no trading. Regulated activities stay gated pending jurisdiction-specific review.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-400">
              <button onClick={() => scrollTo("features")} className="hover:text-paper-100 transition-colors">Features</button>
              <button onClick={() => scrollTo("security")} className="hover:text-paper-100 transition-colors">Security</button>
              <button onClick={() => scrollTo("pricing")} className="hover:text-paper-100 transition-colors">Pricing</button>
              <span className="inline-flex items-center gap-1.5"><Globe size={14} className="text-slate-500" /> Solana mainnet</span>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">
            <span>© {new Date().getFullYear()} Rillio · Small habits. Stronger financial futures.</span>
            <span className="inline-flex items-center gap-1.5"><Cpu size={12} /> BigInt money math · RFC 7807 errors · rate-limited APIs</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------------------------- core loop pipeline ---------------------------- */

const LOOP_STEPS = [
  {
    id: "import",
    icon: <FileText size={16} />,
    title: "Import",
    body: "Drop a CSV or connect a provider. Rows are fingerprinted, deduped, and kept as raw evidence.",
    stat: "sha-256 fingerprints",
    accent: "#64CFE0",
  },
  {
    id: "normalize",
    icon: <Coins size={16} />,
    title: "Normalize",
    body: "Amounts become BigInt minor units. Dates, currencies and directions are validated per row.",
    stat: "zero float math",
    accent: "#62E0B5",
  },
  {
    id: "categorize",
    icon: <SparkIcon size={16} />,
    title: "Categorize",
    body: "Your rules first, then verified merchants, then deterministic heuristics — every decision logged with a reason.",
    stat: "explainable, not vibes",
    accent: "#C5F36A",
  },
  {
    id: "insight",
    icon: <PulseIcon size={16} />,
    title: "Insight",
    body: "Cash-flow trends, burn rate, recurring charges and goal simulations you can actually defend.",
    stat: "deterministic math",
    accent: "#9B8AFB",
  },
];

function CoreLoopSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const reduce = useReducedMotion();

  return (
    <section id="flow" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="text-center max-w-2xl mx-auto">
          <Kicker>The core loop</Kicker>
          <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight mt-3">
            From raw statements to <span className="text-gradient-brand">defensible insight</span>
          </h2>
          <p className="text-slate-400 mt-4">
            Four deterministic stages. No black boxes — every number can show you exactly where it came from.
          </p>
        </Reveal>

        <div ref={ref} className="relative mt-16">
          {/* connector track */}
          <div className="absolute top-[52px] left-0 right-0 h-px hidden lg:block">
            <div className="absolute inset-0 bg-gradient-to-r from-aqua-400/40 via-mint-400/40 to-violet-400/40" />
            {inView && !reduce && (
              <motion.div
                className="absolute top-0 h-px w-24 gradient-flow"
                initial={{ left: "-10%" }}
                animate={{ left: ["-10%", "105%"] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
              />
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-4">
            {LOOP_STEPS.map((s, i) => (
              <Reveal key={s.id} delay={i * 0.12}>
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="relative rounded-2xl border border-white/8 bg-ink-900/80 p-6 h-full overflow-hidden group"
                >
                  <div
                    className="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-0 group-hover:opacity-25 blur-[60px] transition-opacity duration-500"
                    style={{ background: s.accent }}
                  />
                  <div className="relative flex items-center justify-between">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center border"
                      style={{ borderColor: `${s.accent}44`, background: `${s.accent}14`, color: s.accent }}
                    >
                      {s.icon}
                    </div>
                    <span className="num text-[11px] text-slate-600 font-mono">0{i + 1}</span>
                  </div>
                  <h3 className="font-display text-xl font-semibold mt-4">{s.title}</h3>
                  <p className="text-sm text-slate-400 mt-2 leading-relaxed">{s.body}</p>
                  <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: s.accent }}>
                    <span className="w-1 h-1 rounded-full" style={{ background: s.accent }} /> {s.stat}
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* animated transaction ticker mock */}
        <Reveal delay={0.2} className="mt-12">
          <TxnTicker />
        </Reveal>
      </div>
    </section>
  );
}

const TICKER_ROWS = [
  { m: "BLUEWOOD GROCERS", cat: "Groceries", amt: "-$64.12", conf: "verified merchant" },
  { m: "NORDRAIL SEASON PASS", cat: "Transport", amt: "-$89.00", conf: "user rule" },
  { m: "SKYSTREAM MONTHLY", cat: "Subscriptions", amt: "-$12.99", conf: "verified merchant" },
  { m: "PAYROLL — HELIX LABS", cat: "Income", amt: "+$4,200.00", conf: "heuristic" },
  { m: "CAFFE NERO #442", cat: "Dining", amt: "-$6.40", conf: "verified merchant" },
  { m: "UTILOS CITY WATER", cat: "Utilities", amt: "-$38.75", conf: "user rule" },
];

function TxnTicker() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % TICKER_ROWS.length), 2600);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <div className="rounded-2xl border border-white/8 bg-ink-900/70 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 text-[11px] text-slate-500">
        <span className="w-2 h-2 rounded-full bg-mint-400 animate-pulse" />
        Live categorization preview — deterministic pipeline, illustrative data
      </div>
      <div className="divide-y divide-white/5">
        <AnimatePresence mode="popLayout" initial={false}>
          {[0, 1, 2, 3].map((slot) => {
            const row = TICKER_ROWS[(index + slot) % TICKER_ROWS.length];
            return (
              <motion.div
                key={`${row.m}-${index + slot}`}
                layout
                initial={reduce ? { opacity: 0 } : { opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -40 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <span className="w-1 h-8 rounded-full" style={{ background: slot === 0 ? "#C5F36A" : "#1E2C3F" }} />
                <span className="flex-1 truncate text-paper-100">{row.m}</span>
                <span className="hidden sm:inline text-[11px] px-2 py-0.5 rounded-full border border-white/10 text-slate-400 bg-white/5">
                  {row.cat}
                </span>
                <span className="hidden md:inline text-[10px] text-slate-600 w-32 text-right">{row.conf}</span>
                <span className={`num w-24 text-right font-medium ${row.amt.startsWith("+") ? "text-mint-400" : "text-slate-300"}`}>
                  {row.amt}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ------------------------------ bento features ------------------------------ */

function FeaturesSection() {
  const reduce = useReducedMotion();
  const sparkData = [42, 38, 45, 51, 47, 58, 54, 62, 59, 68, 64, 72];

  return (
    <section id="features" className="relative py-24 sm:py-32 bg-ink-900/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="max-w-2xl">
          <Kicker>Features</Kicker>
          <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight mt-3">
            A workspace that earns <span className="text-gradient-brand">trust by default</span>
          </h2>
          <p className="text-slate-400 mt-4">
            Every capability ships with its boundary states visible. If the RPC is rate-limited, you see stale — not a fake zero.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-6">
          {/* Big card — cash flow */}
          <Reveal className="md:col-span-4" delay={0}>
            <BentoCard
              icon={<FlowIcon size={18} className="text-mint-400" />}
              title="Cash-flow intelligence"
              body="Trends by day, month and category with burn-rate projection. Hover any point and the tooltip shows the exact integer math behind it."
              className="h-full"
            >
              <div className="mt-5 relative">
                <svg viewBox="0 0 520 140" className="w-full h-36" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="bentoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#62E0B5" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#62E0B5" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[28, 56, 84, 112].map((y) => (
                    <line key={y} x1="0" y1={y} x2="520" y2={y} stroke="rgba(255,255,255,0.05)" />
                  ))}
                  <motion.path
                    d={`M0,${140 - sparkData[0]} ${sparkData.map((v, i) => `L${(i * 520) / (sparkData.length - 1)},${140 - v}`).join(" ")} L520,140 L0,140 Z`}
                    fill="url(#bentoGrad)"
                    initial={reduce ? {} : { opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, delay: 0.3 }}
                  />
                  <motion.path
                    d={`M0,${140 - sparkData[0]} ${sparkData.map((v, i) => `L${(i * 520) / (sparkData.length - 1)},${140 - v}`).join(" ")}`}
                    fill="none"
                    stroke="#62E0B5"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    initial={reduce ? {} : { pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.6, ease: EASE }}
                  />
                </svg>
                <div className="flex justify-between text-[10px] text-slate-600 mt-1 num">
                  <span>12 months outflow</span>
                  <span className="text-mint-400">−9.4% vs prior period</span>
                </div>
              </div>
            </BentoCard>
          </Reveal>

          {/* Goal ring */}
          <Reveal className="md:col-span-2" delay={0.08}>
            <BentoCard
              icon={<GoalIcon size={18} className="text-lime-400" />}
              title="Goals are plans, not custody"
              body="Simulate contributions with and without assumed returns. Assumptions are always labeled and never silently compounded."
              className="h-full"
            >
              <div className="mt-4 flex items-center gap-4">
                <GoalRing pct={68} />
                <div className="text-xs text-slate-400 leading-relaxed">
                  <div className="text-paper-100 font-medium">Emergency fund</div>
                  <div className="num mt-1">$6,800 / $10,000</div>
                  <div className="mt-1 text-slate-500">No assumed return: $9,050 by Jun</div>
                  <div className="text-warning-500">7% assumed: labeled, not guaranteed</div>
                </div>
              </div>
            </BentoCard>
          </Reveal>

          {/* Portfolio */}
          <Reveal className="md:col-span-2" delay={0.12}>
            <BentoCard
              icon={<OrbitIcon size={18} className="text-violet-400" />}
              title="Read-only Solana portfolio"
              body="Connect via signed challenge or plain address. Keys never touch Rillio; token accounts refresh through a rate-limited RPC with honest staleness."
              className="h-full"
            >
              <div className="mt-4 space-y-2">
                {[
                  ["SOL", "65.75", "priced · Jupiter", "#C5F36A"],
                  ["USDC", "1,204.50", "priced · stable", "#62E0B5"],
                  ["JUP", "—", "unpriced · no quote", "#F3B95F"],
                ].map(([sym, amt, note, c]) => (
                  <div key={sym} className="flex items-center justify-between text-xs rounded-lg bg-ink-850 border border-white/5 px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: c }} />
                      <span className="text-paper-100 font-medium">{sym}</span>
                    </span>
                    <span className="num text-paper-100">{amt}</span>
                    <span className="text-[10px] text-slate-500">{note}</span>
                  </div>
                ))}
                <p className="text-[10px] text-slate-600">Unpriced assets stay unpriced — we never invent a number.</p>
              </div>
            </BentoCard>
          </Reveal>

          {/* Subscriptions */}
          <Reveal className="md:col-span-2" delay={0.16}>
            <BentoCard
              icon={<RefreshCw size={18} className="text-aqua-400" />}
              title="Subscription radar"
              body="Deterministic recurring detection: same merchant in ≥ 3 months, amounts within 20% of median. A monthly total you can verify by hand."
              className="h-full"
            >
              <div className="mt-4 flex items-end gap-2 h-20">
                {[14, 15, 13, 16, 14, 15].map((h, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 rounded-t-md gradient-flow"
                    initial={reduce ? {} : { height: 0 }}
                    whileInView={{ height: `${h * 6}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, delay: i * 0.06, ease: EASE }}
                  />
                ))}
              </div>
              <div className="mt-3 text-xs text-slate-400 num">Estimated recurring: $79.37 / month</div>
            </BentoCard>
          </Reveal>

          {/* Privacy */}
          <Reveal className="md:col-span-2" delay={0.2}>
            <BentoCard
              icon={<KeyRound size={18} className="text-mint-400" />}
              title="Privacy as a product"
              body="Dated, versioned consents; one-click full export; deletion with a 30-day grace window. Your workspace stays yours."
              className="h-full"
            >
              <div className="mt-4 space-y-2 text-xs">
                {["Export everything as JSON", "Withdraw any consent, instantly", "Hard delete after grace period"].map((t) => (
                  <div key={t} className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 size={13} className="text-mint-400 shrink-0" /> {t}
                  </div>
                ))}
              </div>
            </BentoCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function BentoCard({
  icon,
  title,
  body,
  children,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
      className={`rounded-2xl border border-white/8 bg-ink-900/80 p-6 h-full overflow-hidden relative group hover:border-white/15 transition-colors ${className ?? ""}`}
    >
      <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-mint-400/8 blur-[70px] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      <div className="relative">
        <div className="flex items-center gap-2.5">
          {icon}
          <h3 className="font-display text-lg font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">{body}</p>
        {children}
      </div>
    </motion.div>
  );
}

function GoalRing({ pct }: { pct: number }) {
  const reduce = useReducedMotion();
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0" aria-hidden="true">
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
      <motion.circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="#C5F36A"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={reduce ? {} : { strokeDashoffset: c }}
        whileInView={{ strokeDashoffset: c * (1 - pct / 100) }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, ease: EASE }}
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" textAnchor="middle" className="fill-paper-100" style={{ fontSize: 13, fontWeight: 600 }}>
        {pct}%
      </text>
    </svg>
  );
}

/* ----------------------------- security section ----------------------------- */

const AUDIT_STREAM = [
  { t: "12:04:18", a: "auth.login", d: "Chrome on macOS · session issued" },
  { t: "12:04:47", a: "import.completed", d: "Statement_2026-03.csv · 128/130 rows" },
  { t: "12:05:02", a: "connection.consent_granted", d: "demo bank · scope=read_transactions · v1" },
  { t: "12:06:31", a: "billing.payment_verified", d: "USDC transfer · 6 checks · finalized" },
  { t: "12:07:09", a: "wallet.linked", d: "7xKX…uhxJ · ed25519 challenge verified" },
];

const POSTURE_ITEMS = [
  {
    icon: <ScrollText size={16} />,
    title: "Append-only audit trail",
    body: "Every sign-in, import, consent, connection and payment verification is recorded with actor, resource and request id. Users see their own trail in-product.",
  },
  {
    icon: <MonitorSmartphone size={16} />,
    title: "Device & session control",
    body: "Hashed session tokens, remote revoke per device, one-click \u201crevoke everything else\u201d for stolen-cookie response.",
  },
  {
    icon: <Lock size={16} />,
    title: "Encrypted at rest",
    body: "Provider credentials sealed with AES-256-GCM. Session tokens exist only as SHA-256 hashes. No plaintext secrets anywhere.",
  },
  {
    icon: <Shield size={16} />,
    title: "Hardened edge",
    body: "CSP, frame denial, nosniff, strict referrer, HSTS — enforced by middleware. Rate limits per bucket with RFC 7807 429 responses.",
  },
  {
    icon: <Coins size={16} />,
    title: "Exact money math",
    body: "BigInt minor units end-to-end. No floats in the ledger, no rounding surprises, currency-aware formatting.",
  },
  {
    icon: <BadgeCheck size={16} />,
    title: "Verification-gated billing",
    body: "Six server-side checks (signature, amount, mint, recipient, reference, finality) before an entitlement moves. Redirects grant nothing.",
  },
];

function SecuritySection() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(2);

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setVisible((v) => (v + 1) % (AUDIT_STREAM.length + 1)), 1700);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <section id="security" className="relative py-24 sm:py-32 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% 40%, rgba(98,224,181,0.08), transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <Reveal>
              <Kicker>Enterprise posture</Kicker>
              <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight mt-3">
                Built like critical infra,<br />honest like a ledger
              </h2>
              <p className="text-slate-400 mt-4 leading-relaxed">
                Rillio treats your personal finance data the way banks treat theirs: append-only trails, encrypted
                credentials, rate-limited surfaces, and verification-gated state changes — all visible to you,
                not hidden behind a status page.
              </p>
            </Reveal>

            <div className="mt-8 grid sm:grid-cols-2 gap-3">
              {POSTURE_ITEMS.map((item, i) => (
                <Reveal key={item.title} delay={i * 0.06}>
                  <div className="rounded-xl border border-white/8 bg-ink-900/80 p-4 h-full hover:border-mint-400/25 transition-colors">
                    <div className="flex items-center gap-2 text-sm font-medium text-paper-100">
                      <span className="text-mint-400">{item.icon}</span> {item.title}
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{item.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* live audit stream mock */}
          <Reveal delay={0.15}>
            <div className="rounded-2xl border border-white/8 bg-ink-900/90 overflow-hidden shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ScrollText size={15} className="text-lime-400" /> Audit trail
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-lime-400/10 text-lime-400 border border-lime-400/25 uppercase tracking-wide">append-only</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">user: you</span>
              </div>
              <div className="p-3 space-y-1.5 min-h-[290px]">
                <AnimatePresence initial={false}>
                  {AUDIT_STREAM.slice(0, visible).map((ev) => (
                    <motion.div
                      key={ev.t + ev.a}
                      layout
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className="flex items-start gap-3 rounded-lg bg-ink-850/80 border border-white/5 px-3 py-2.5"
                    >
                      <span className="text-[10px] text-slate-500 font-mono num mt-0.5 w-14">{ev.t}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-paper-100 font-mono">{ev.a}</div>
                        <div className="text-[11px] text-slate-400 truncate">{ev.d}</div>
                      </div>
                      <BadgeCheck size={13} className="text-slate-600 shrink-0" />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <div className="px-4 py-2.5 border-t border-white/5 text-[10px] text-slate-500 flex items-center justify-between">
                <span>Illustrative stream — your real trail lives in Trust &amp; Security</span>
                <span className="font-mono text-slate-600">request-id: req_9f3k…</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- payments section ----------------------------- */

function PaymentsSection() {
  const reduce = useReducedMotion();
  const steps = [
    { label: "Create intent", detail: "reference + exact amount + expiry" },
    { label: "Pay onchain", detail: "USDC transfer or native SOL" },
    { label: "Server verifies", detail: "6 checks incl. finality" },
    { label: "Entitlement moves", detail: "only after verified settlement" },
  ];

  return (
    <section id="payments" className="relative py-24 sm:py-32 bg-ink-900/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="text-center max-w-2xl mx-auto">
          <Kicker>Payments</Kicker>
          <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight mt-3">
            Solana-native. <span className="text-gradient-brand">No cards, no middlemen.</span>
          </h2>
          <p className="text-slate-400 mt-4">
            Rillio Plus is priced in dollars and settled onchain in USDC or native SOL. The server verifies the
            transfer itself — the browser can never grant itself access.
          </p>
        </Reveal>

        <div className="mt-14 relative max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-4 gap-3">
            {steps.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.1}>
                <div className="relative rounded-xl border border-white/8 bg-ink-900/80 p-4 h-full">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-lime-400/15 border border-lime-400/30 text-lime-400 text-xs flex items-center justify-center num font-semibold">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-paper-100">{s.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 font-mono">{s.detail}</p>
                </div>
              </Reveal>
            ))}
          </div>
          {/* moving pulse across steps */}
          {!reduce && (
            <motion.div
              className="absolute -top-2 left-0 h-1 w-16 gradient-brand rounded-full hidden sm:block"
              animate={{ left: ["4%", "88%"] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3 max-w-4xl mx-auto">
          <Reveal delay={0.1}>
            <div className="rounded-xl border border-lime-400/20 bg-lime-400/5 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium text-lime-400"><Coins size={15} /> USDC settled</div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">Exact base units, matching mint and recipient, verified finality before your plan activates.</p>
            </div>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="rounded-xl border border-mint-400/20 bg-mint-400/5 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium text-mint-400"><Zap size={15} /> Native SOL accepted</div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">Quoted at payment time; the quote and its source are recorded on the intent for reconciliation.</p>
            </div>
          </Reveal>
          <Reveal delay={0.22}>
            <div className="rounded-xl border border-white/8 bg-ink-900/80 p-4 text-sm">
              <div className="flex items-center gap-2 font-medium text-slate-300"><CircleAlert size={15} className="text-warning-500" /> Honest boundaries</div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">Pending finality shows as pending. Failed checks show why. Nothing is ever silently granted.</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ pricing section ----------------------------- */

function PricingSection({ onGetStarted }: { onGetStarted: () => void }) {
  const plusFeatures = [
    "Unlimited CSV imports",
    "Subscription radar + custom rules",
    "Portfolio analytics",
    "Scenario planning with labeled assumptions",
    "Full JSON exports",
    "50 goals, multi-currency",
  ];
  const freeFeatures = [
    "1,000 imported rows",
    "Core dashboard & categories",
    "Read-only Solana wallet link",
    "3 active goals",
    "Audit trail & sessions",
  ];

  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal className="text-center">
          <Kicker>Pricing</Kicker>
          <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight mt-3">
            Pay in <span className="text-gradient-brand">USDC or SOL</span>
          </h2>
          <p className="text-slate-400 mt-4">No card processor. No stored payment methods. Cancel any time — access runs to period end.</p>
        </Reveal>

        <div className="mt-14 grid md:grid-cols-2 gap-5">
          <Reveal>
            <div className="rounded-2xl border border-white/8 bg-ink-900/80 p-7 h-full">
              <h3 className="font-display text-xl font-semibold">Free</h3>
              <div className="num font-display text-4xl font-semibold mt-3">$0<span className="text-base text-slate-500 font-sans font-normal"> /month</span></div>
              <p className="text-sm text-slate-400 mt-2">Everything you need to see your money clearly.</p>
              <ul className="mt-6 space-y-2.5 text-sm text-slate-300">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="text-slate-500 mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Button variant="outline" onClick={onGetStarted} className="w-full mt-7 border-white/15 h-11 hover:bg-white/5">
                Start free
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative rounded-2xl border border-lime-400/30 bg-gradient-to-b from-lime-400/8 to-ink-900/90 p-7 h-full overflow-hidden">
              <div className="absolute top-4 right-4 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-lime-400 text-ink-950 font-semibold">
                Solana-only
              </div>
              <h3 className="font-display text-xl font-semibold">Rillio Plus</h3>
              <div className="num font-display text-4xl font-semibold mt-3 text-gradient-brand">$8<span className="text-base text-slate-500 font-sans font-normal"> /month</span></div>
              <p className="text-sm text-slate-400 mt-2">For people who want the whole picture — and proof behind every number.</p>
              <ul className="mt-6 space-y-2.5 text-sm text-slate-200">
                {plusFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckCircle2 size={15} className="text-lime-400 mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Button onClick={onGetStarted} className="w-full mt-7 bg-lime-400 text-ink-950 hover:bg-lime-300 h-11 font-semibold">
                Create account &amp; pay onchain <ArrowRight size={15} className="ml-1" />
              </Button>
              <p className="text-[10px] text-slate-500 mt-3 text-center">
                Entitlement activates only after server-side onchain verification.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- FAQ section ------------------------------- */

const FAQS = [
  {
    q: "Does Rillio hold my money?",
    a: "No. Rillio is read-only by design. Goals are planning records — not held funds. Your Solana connection is a public address; private keys never touch the app, and there are no transfer or trading functions in the MVP.",
  },
  {
    q: "How does billing work without a card processor?",
    a: "Plans are settled onchain: you create a payment intent, send exactly the quoted amount in USDC or native SOL, and the server verifies signature, amount, mint, recipient, reference and finality before Plus activates. Nothing happens from a browser redirect alone.",
  },
  {
    q: "What happens when the Solana RPC is rate-limited?",
    a: "Your portfolio shows an explicit 'stale' state with the last good snapshot — never a fabricated zero. Public RPCs have limits; a dedicated provider removes most of them, and the UI always tells you which state you are in.",
  },
  {
    q: "How are transactions categorized?",
    a: "Deterministically, in priority order: your own rules first, then verified merchant matches, then conservative heuristics. Every categorization records which method decided it, so corrections are easy and the system improves from your edits.",
  },
  {
    q: "Where does my data live, and can I leave?",
    a: "In your single-tenant workspace. You can export everything as JSON at any time, withdraw any consent from the ledger, and request deletion — 30 days of grace, then a hard delete with audit tombstones preserved.",
  },
  {
    q: "Is this financial advice?",
    a: "No. Rillio is a personal finance workspace. All projections are deterministic math on the numbers you gave, with assumptions explicitly labeled. It is not legal, investment, or regulatory advice.",
  },
];

function FaqSection({ onGetStarted }: { onGetStarted: () => void }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal className="text-center">
          <Kicker>Questions</Kicker>
          <h2 className="font-display text-4xl font-semibold tracking-tight mt-3">Straight answers</h2>
        </Reveal>
        <div className="mt-10 space-y-2.5">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={i * 0.05}>
                <div className={`rounded-xl border transition-colors ${isOpen ? "border-lime-400/25 bg-ink-900/90" : "border-white/8 bg-ink-900/60 hover:border-white/15"}`}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-medium text-paper-100">{f.q}</span>
                    <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }} className="text-slate-400">
                      <ChevronDown size={16} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-sm text-slate-400 leading-relaxed">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* final CTA */}
        <Reveal delay={0.15} className="mt-16">
          <div className="relative rounded-3xl border border-white/10 overflow-hidden p-10 text-center bg-gradient-to-b from-ink-900 to-ink-850">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[220px] rounded-full bg-lime-400/15 blur-[90px]" />
            <RillioMark size={40} className="mx-auto relative" />
            <h3 className="font-display text-3xl font-semibold mt-4 relative">Start seeing clearly tonight.</h3>
            <p className="text-slate-400 mt-2 text-sm relative">Import one statement. That&apos;s the whole onboarding.</p>
            <Button size="lg" onClick={onGetStarted} className="mt-6 bg-lime-400 text-ink-950 hover:bg-lime-300 font-semibold h-12 px-8 relative">
              Create your workspace <ArrowRight size={16} className="ml-1.5" />
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

