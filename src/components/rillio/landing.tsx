"use client";

/**
 * Rillio landing page.
 *
 * 3D mouse-parallax hero with a floating financial card stack (CSS 3D +
 * framer-motion springs), animated core-loop flow, scroll-reveal sections,
 * animated counters, Solana payments section, pricing and CTA.
 *
 * Honors prefers-reduced-motion: heavy motion collapses to fades.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useInView,
  useScroll,
  useReducedMotion,
  animate,
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
  Wallet,
  ArrowRight,
  CheckCircle2,
  Shield,
  Lock,
  FileText,
  TrendingUp,
  Target,
  Coins,
  Zap,
  Github,
  Globe,
  ChevronDown,
} from "lucide-react";

const EASE = [0.2, 0.8, 0.2, 1] as const;

/* ---------------------------------- Reveal ---------------------------------- */

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
      initial={reduce ? { opacity: 0 } : { opacity: 0, y, filter: "blur(6px)" }}
      animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* --------------------------------- Counter --------------------------------- */

function Counter({ to, prefix = "", suffix = "", decimals = 0 }: { to: number; prefix?: string; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration: 1.6,
      ease: EASE,
      onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [inView, to]);
  return (
    <span ref={ref} className="num">
      {prefix}
      {val.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ------------------------------ Hero card stack ----------------------------- */

function TiltCard({ children, depth = 0, className }: { children: React.ReactNode; depth?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      style={{ transform: `translateZ(${depth}px)` }}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.2 + depth * 0.0004, ease: EASE }}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5 + depth * 0.003, repeat: Infinity, ease: "easeInOut", delay: depth * 0.001 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function HeroScene() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 60, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-14, 14]), { stiffness: 60, damping: 18 });
  const reduce = useReducedMotion();

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reduce) return;
      const rect = e.currentTarget.getBoundingClientRect();
      mx.set((e.clientX - rect.left) / rect.width - 0.5);
      my.set((e.clientY - rect.top) / rect.height - 0.5);
    },
    [mx, my, reduce]
  );

  return (
    <div
      className="relative [perspective:1400px]"
      onMouseMove={onMouseMove}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      <motion.div style={reduce ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }} className="relative">
        {/* Glow */}
        <div className="absolute -inset-8 rounded-[48px] opacity-60 blur-3xl pointer-events-none"
             style={{ background: "radial-gradient(60% 60% at 50% 40%, rgba(98,224,181,0.25), transparent 70%)" }} />

        {/* Card 1 — Financial snapshot (front) */}
        <TiltCard depth={60}>
          <div className="relative z-30 w-[320px] sm:w-[360px] rounded-2xl border border-white/10 bg-ink-800/90 backdrop-blur-xl shadow-2xl shadow-black/50 p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">Financial snapshot</div>
              <span className="flex items-center gap-1 text-[10px] text-mint-400">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-400 animate-pulse" /> live
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <Counter to={4820.35} prefix="$" decimals={2} />
              <span className="text-xs text-slate-500">net this month</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: "Inflow", v: "+$6,420", c: "text-mint-400" },
                { label: "Outflow", v: "-$1,599", c: "text-paper-100" },
                { label: "Goals", v: "3/3 on plan", c: "text-lime-400" },
              ].map((m) => (
                <div key={m.label} className="rounded-lg bg-ink-850 border border-white/5 p-2">
                  <div className="text-[10px] text-slate-500">{m.label}</div>
                  <div className={`text-xs num font-medium ${m.c}`}>{m.v}</div>
                </div>
              ))}
            </div>
            {/* mini sparkline */}
            <svg viewBox="0 0 320 56" className="mt-4 w-full h-14">
              <defs>
                <linearGradient id="lg-spark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#62E0B5" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#62E0B5" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 44 C30 40 45 30 70 32 C95 34 110 18 140 22 C170 26 190 10 220 14 C250 18 280 6 320 8 L320 56 L0 56 Z"
                fill="url(#lg-spark)"
              />
              <motion.path
                d="M0 44 C30 40 45 30 70 32 C95 34 110 18 140 22 C170 26 190 10 220 14 C250 18 280 6 320 8"
                fill="none"
                stroke="#62E0B5"
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.8, ease: EASE }}
              />
            </svg>
          </div>
        </TiltCard>

        {/* Card 2 — Goal (mid layer, offset) */}
        <TiltCard depth={30} className="absolute -bottom-14 -left-10 sm:-left-16 z-20">
          <div className="w-[240px] rounded-2xl border border-white/10 bg-ink-850/95 backdrop-blur-xl shadow-xl shadow-black/40 p-4">
            <div className="flex items-center gap-2">
              <GoalIcon size={16} className="text-lime-400" />
              <span className="text-xs font-medium">Emergency buffer</span>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full border border-white/10 text-slate-400">plan</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-ink-700 overflow-hidden">
              <motion.div
                className="h-full rounded-full gradient-brand"
                initial={{ width: 0 }}
                whileInView={{ width: "68%" }}
                viewport={{ once: true }}
                transition={{ duration: 1.4, delay: 0.4, ease: EASE }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-slate-400 num">
              <span>$3,400</span>
              <span className="text-slate-500">of $5,000</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Planned allocation · not held funds</p>
          </div>
        </TiltCard>

        {/* Card 3 — Solana portfolio (back layer, offset right) */}
        <TiltCard depth={-20} className="absolute -top-10 -right-8 sm:-right-14 z-10">
          <div className="w-[230px] rounded-2xl border border-white/10 bg-ink-850/95 backdrop-blur-xl shadow-xl shadow-black/40 p-4">
            <div className="flex items-center gap-2">
              <OrbitIcon size={16} className="text-violet-400" />
              <span className="text-xs font-medium">Solana wallet</span>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full border border-mint-400/30 text-mint-400">read-only</span>
            </div>
            <div className="mt-3 space-y-2">
              {[
                { s: "SOL", a: "12.46", v: "$2,341" },
                { s: "USDC", a: "850.00", v: "$850" },
                { s: "JitoSOL", a: "4.02", v: "$712" },
              ].map((r, i) => (
                <motion.div
                  key={r.s}
                  className="flex items-center justify-between text-[11px]"
                  initial={{ opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.15, duration: 0.5, ease: EASE }}
                >
                  <span className="text-slate-300 font-medium">{r.s}</span>
                  <span className="text-slate-400 num">{r.a}</span>
                  <span className="text-paper-100 num">{r.v}</span>
                </motion.div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
              <SourceIcon size={10} /> provenance + freshness on every quote
            </p>
          </div>
        </TiltCard>

        {/* Floating chips */}
        <motion.div
          className="absolute -left-6 top-24 z-40 hidden sm:flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-900/90 backdrop-blur px-3 py-1.5 text-[11px] text-slate-300 shadow-lg"
          animate={reduce ? undefined : { y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Shield size={12} className="text-mint-400" /> non-custodial
        </motion.div>
        <motion.div
          className="absolute -right-4 bottom-28 z-40 hidden sm:flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-900/90 backdrop-blur px-3 py-1.5 text-[11px] text-slate-300 shadow-lg"
          animate={reduce ? undefined : { y: [0, 10, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        >
          <Zap size={12} className="text-lime-400" /> Solana payments
        </motion.div>
      </motion.div>
    </div>
  );
}

/* --------------------------------- Core loop -------------------------------- */

const LOOP_STEPS = [
  { icon: <Wallet size={18} />, label: "Earn", desc: "Connect real history" },
  { icon: <FlowIcon size={18} />, label: "Spend", desc: "Imported, deduped, categorized" },
  { icon: <PulseIcon size={18} />, label: "Understand", desc: "Deterministic cash flow" },
  { icon: <Target size={18} />, label: "Plan", desc: "Goals with honest math" },
  { icon: <Coins size={18} />, label: "Save", desc: "Habits that compound" },
  { icon: <OrbitIcon size={18} />, label: "Own", desc: "Read-only Solana portfolio" },
  { icon: <SparkIcon size={18} />, label: "Review", desc: "Weekly rhythm" },
];

function CoreLoop() {
  return (
    <div className="relative">
      <div className="flex gap-3 overflow-x-auto pb-4 snap-x lg:grid lg:grid-cols-7 lg:overflow-visible">
        {LOOP_STEPS.map((s, i) => (
          <motion.div
            key={s.label}
            className="snap-start flex-shrink-0 lg:flex-shrink lg:flex lg:flex-col items-center text-center relative"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: i * 0.12, duration: 0.55, ease: EASE }}
          >
            <div className="relative">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-ink-800 border border-white/10 flex items-center justify-center text-mint-400 shadow-lg shadow-black/30">
                {s.icon}
              </div>
              {i < LOOP_STEPS.length - 1 && (
                <svg className="hidden lg:block absolute top-6 left-[calc(50%+28px)] w-[calc(100%-8px)]" height="2">
                  <motion.line
                    x1="0" y1="1" x2="100%" y2="1"
                    stroke="#25364B"
                    strokeWidth="2"
                    strokeDasharray="6 6"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.12 + 0.3, duration: 0.6, ease: EASE }}
                  />
                </svg>
              )}
            </div>
            <div className="mt-3 text-sm font-medium">{s.label}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 max-w-[120px] leading-snug">{s.desc}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- Features --------------------------------- */

const FEATURES = [
  {
    icon: <FileText size={20} className="text-mint-400" />,
    title: "Real transaction import",
    body: "CSV upload with column detection, exact integer money math, duplicate fingerprints and a rejected-row report. No silent loss — totals reconcile to accepted rows.",
    tag: "FR-DATA-001",
  },
  {
    icon: <PulseIcon size={20} className="text-lime-400" />,
    title: "Deterministic cash flow",
    body: "Categories follow a transparent precedence: your correction beats your rules, rules beat merchant defaults, defaults beat heuristics. Every decision is explainable and versioned.",
    tag: "FR-CAT-001",
  },
  {
    icon: <GoalIcon size={20} className="text-mint-400" />,
    title: "Honest savings plans",
    body: "Goals are plans, never pretend custody. Projections assume no yield by default; optional assumed-return scenarios are labelled illustrative and not guaranteed.",
    tag: "FR-GOAL-002",
  },
  {
    icon: <OrbitIcon size={20} className="text-violet-400" />,
    title: "Read-only Solana ownership",
    body: "Connect a wallet to see SOL and supported SPL/Token-2022 assets with mint identity, price provenance and freshness. RPC failure shows stale data — never a fake zero.",
    tag: "FR-CHAIN-002",
  },
  {
    icon: <Zap size={20} className="text-lime-400" />,
    title: "Solana-native payments",
    body: "Rillio Plus is paid onchain: USDC or native SOL via the Solana Pay reference standard. The server verifies amount, recipient, reference and finality before unlocking anything.",
    tag: "FR-PAY-002",
  },
  {
    icon: <ShieldIcon size={20} className="text-mint-400" />,
    title: "Privacy by default",
    body: "Granular, dated consent records. Export your data or schedule deletion in one click. Wallets stay private; nothing is shared unless you decide it is.",
    tag: "FR-PRIV-001",
  },
];

function FeatureCard({ f, i }: { f: (typeof FEATURES)[number]; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 120, damping: 16 });
  const sry = useSpring(ry, { stiffness: 120, damping: 16 });
  const reduce = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: (i % 3) * 0.1, duration: 0.6, ease: EASE }}
      onMouseMove={(e) => {
        if (reduce) return;
        const r = e.currentTarget.getBoundingClientRect();
        rx.set(((e.clientY - r.top) / r.height - 0.5) * -8);
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 8);
      }}
      onMouseLeave={() => { rx.set(0); ry.set(0); }}
      style={reduce ? undefined : { rotateX: srx, rotateY: sry, transformStyle: "preserve-3d" }}
      className="group rounded-2xl border border-white/10 bg-ink-800/80 backdrop-blur p-6 hover:border-mint-400/30 transition-colors [perspective:800px]"
    >
      <div className="w-10 h-10 rounded-xl bg-ink-850 border border-white/10 flex items-center justify-center" style={{ transform: "translateZ(24px)" }}>
        {f.icon}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold" style={{ transform: "translateZ(16px)" }}>{f.title}</h3>
      <p className="mt-2 text-sm text-slate-400 leading-relaxed">{f.body}</p>
      <div className="mt-4 inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono" style={{ transform: "translateZ(8px)" }}>
        <SourceIcon size={10} /> {f.tag}
      </div>
    </motion.div>
  );
}

/* ---------------------------------- Pricing ---------------------------------- */

function PricingSection({ onGetStarted }: { onGetStarted: () => void }) {
  const plusFeatures = [
    "100,000-row CSV imports",
    "Multi-account & multi-currency",
    "Recurring detection",
    "Custom rules",
    "Up to 50 goals",
    "Scenario planning",
    "Exports & portfolio analytics",
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-2 max-w-4xl mx-auto">
      <Reveal>
        <div className="rounded-2xl border border-white/10 bg-ink-800/80 p-7 h-full">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold">Free</h3>
            <span className="text-xs px-2 py-1 rounded-full border border-white/10 text-slate-400">forever</span>
          </div>
          <div className="mt-4 num font-display text-4xl font-semibold">$0<span className="text-sm text-slate-500 font-sans">/mo</span></div>
          <ul className="mt-6 space-y-2.5 text-sm">
            {["One workspace", "1,000-row imports", "Basic categories & trends", "3 goals", "Read-only wallet view", "Privacy export"].map((f) => (
              <li key={f} className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 size={15} className="text-slate-500" /> {f}
              </li>
            ))}
          </ul>
          <button
            onClick={onGetStarted}
            className="mt-7 w-full h-10 rounded-xl border border-white/10 text-sm hover:bg-white/5 transition-colors"
          >
            Start free
          </button>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="relative rounded-2xl border border-lime-400/30 bg-gradient-to-b from-ink-800 to-ink-850 p-7 h-full overflow-hidden">
          <div className="absolute top-0 right-0 px-3 py-1 text-[10px] font-semibold gradient-brand text-ink-950 rounded-bl-2xl">PLUS</div>
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-25" style={{ background: "radial-gradient(circle, #C5F36A, transparent 70%)" }} />
          <h3 className="font-display text-xl font-semibold">Rillio Plus</h3>
          <div className="mt-4 num font-display text-4xl font-semibold">$8<span className="text-sm text-slate-500 font-sans">/mo</span></div>
          <p className="mt-1 text-xs text-mint-400 flex items-center gap-1">
            <Zap size={12} /> paid onchain — USDC or native SOL
          </p>
          <ul className="mt-6 space-y-2.5 text-sm">
            {plusFeatures.map((f) => (
              <li key={f} className="flex items-center gap-2 text-slate-200">
                <CheckCircle2 size={15} className="text-mint-400" /> {f}
              </li>
            ))}
          </ul>
          <button
            onClick={onGetStarted}
            className="mt-7 w-full h-10 rounded-xl gradient-brand text-ink-950 text-sm font-semibold hover:brightness-110 transition-all"
          >
            Get Plus with Solana
          </button>
        </div>
      </Reveal>
    </div>
  );
}

/* ---------------------------------- Landing ---------------------------------- */

export function Landing({ onGetStarted, onSignIn }: { onGetStarted: () => void; onSignIn: () => void }) {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* Ambient background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse 55% 45% at 15% 0%, rgba(98,224,181,0.10), transparent 60%), radial-gradient(ellipse 45% 40% at 85% 8%, rgba(155,138,251,0.09), transparent 60%)",
        }} />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, black 30%, transparent 75%)",
          }}
        />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-ink-950/70 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <RillioWordmark size={26} />
          <nav className="hidden md:flex items-center gap-7 text-sm text-slate-300">
            <a href="#how" className="hover:text-paper-100 transition-colors">How it works</a>
            <a href="#features" className="hover:text-paper-100 transition-colors">Features</a>
            <a href="#security" className="hover:text-paper-100 transition-colors">Security</a>
            <a href="#payments" className="hover:text-paper-100 transition-colors">Payments</a>
            <a href="#pricing" className="hover:text-paper-100 transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={onSignIn} className="text-sm text-slate-300 hover:text-paper-100 transition-colors px-3 py-2">
              Sign in
            </button>
            <button
              onClick={onGetStarted}
              className="h-9 px-4 rounded-xl gradient-brand text-ink-950 text-sm font-semibold hover:brightness-110 transition-all inline-flex items-center gap-1.5"
            >
              Get started <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section ref={heroRef} className="relative pt-16 lg:pt-24 pb-28">
        <motion.div style={heroOpacity} className="max-w-7xl mx-auto px-5 grid lg:grid-cols-2 gap-16 items-center">
          <motion.div style={heroY}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-ink-850/80 px-3 py-1.5 text-xs text-slate-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-mint-400 animate-pulse" />
              Built on Solana · read-only MVP · non-custodial
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.08, ease: EASE }}
              className="mt-6 font-display text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.06] tracking-tight"
            >
              Small habits.
              <br />
              <span className="text-gradient-brand">Stronger financial futures.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.16, ease: EASE }}
              className="mt-6 text-slate-300 text-base lg:text-lg leading-relaxed max-w-lg"
            >
              Rillio turns real transactions into cash-flow insight, honest savings
              plans and visible onchain ownership — one calm home for your money,
              with you always in control.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.24, ease: EASE }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <button
                onClick={onGetStarted}
                className="h-12 px-6 rounded-xl gradient-brand text-ink-950 font-semibold hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all inline-flex items-center gap-2 shadow-lg shadow-lime-400/20"
              >
                Create your workspace <ArrowRight size={17} />
              </button>
              <a
                href="#how"
                className="h-12 px-6 rounded-xl border border-white/10 text-slate-200 hover:bg-white/5 transition-colors inline-flex items-center gap-2"
              >
                See how it works
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500"
            >
              <span className="flex items-center gap-1.5"><Shield size={13} className="text-mint-400" /> Keys never leave your wallet</span>
              <span className="flex items-center gap-1.5"><Lock size={13} className="text-mint-400" /> Encrypted at rest</span>
              <span className="flex items-center gap-1.5"><FileText size={13} className="text-mint-400" /> Export or delete anytime</span>
            </motion.div>
          </motion.div>

          {/* 3D hero scene */}
          <div className="relative h-[440px] sm:h-[500px] hidden sm:block">
            <HeroScene />
          </div>
          <div className="sm:hidden">
            <HeroScene />
          </div>
        </motion.div>

        {/* Stats bar */}
        <Reveal className="max-w-7xl mx-auto px-5 mt-4">
          <div className="rounded-2xl border border-white/10 bg-ink-850/60 backdrop-blur grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/5 overflow-hidden">
            {[
              { v: <Counter to={99.99} decimals={2} suffix="%" />, l: "deterministic math integrity target" },
              { v: <Counter to={100000} />, l: "rows per Plus import" },
              { v: <Counter to={0} prefix="$" />, l: "custody — we hold nothing" },
              { v: <Counter to={1} suffix="×" />, l: "everything verified onchain before access" },
            ].map((s, i) => (
              <div key={i} className="p-5 text-center">
                <div className="num font-display text-2xl font-semibold text-paper-100">{s.v}</div>
                <div className="text-[11px] text-slate-500 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Core loop */}
      <section id="how" className="relative py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-5">
          <Reveal className="text-center max-w-2xl mx-auto">
            <div className="text-xs uppercase tracking-[0.2em] text-mint-400 font-medium">The core loop</div>
            <h2 className="mt-3 font-display text-3xl lg:text-4xl font-semibold">Every number has a source</h2>
            <p className="mt-4 text-slate-400">
              Rillio links the decisions you already make to a clearer picture of where you are going.
            </p>
          </Reveal>
          <Reveal delay={0.15} className="mt-14">
            <CoreLoop />
          </Reveal>

          {/* How it works — import flow */}
          <div className="mt-16 grid lg:grid-cols-3 gap-5">
            {[
              {
                step: "01",
                title: "Import real history",
                body: "Upload a CSV from any bank. Rillio detects columns, normalizes with exact integer math, fingerprints duplicates and shows a rejected-row report you can export.",
                icon: <FileText size={18} className="text-mint-400" />,
              },
              {
                step: "02",
                title: "See your money clearly",
                body: "Cash flow, category trends and recurring merchants — every figure explainable down to the source row. Correct a category and the rationale is versioned, never silently overwritten.",
                icon: <PulseIcon size={18} className="text-lime-400" />,
              },
              {
                step: "03",
                title: "Plan, then own",
                body: "Give savings a target with honest projections. Connect a Solana wallet to see what you own — with provenance, freshness and an explicit unverified state when identity is unknown.",
                icon: <OrbitIcon size={18} className="text-violet-400" />,
              },
            ].map((s, i) => (
              <Reveal key={s.step} delay={i * 0.12}>
                <div className="relative rounded-2xl border border-white/10 bg-ink-800/70 p-6 overflow-hidden">
                  <div className="absolute top-4 right-5 font-display text-5xl font-bold text-white/5 select-none">{s.step}</div>
                  <div className="w-10 h-10 rounded-xl bg-ink-850 border border-white/10 flex items-center justify-center">{s.icon}</div>
                  <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-5">
          <Reveal className="text-center max-w-2xl mx-auto">
            <div className="text-xs uppercase tracking-[0.2em] text-mint-400 font-medium">Product systems</div>
            <h2 className="mt-3 font-display text-3xl lg:text-4xl font-semibold">Serious data integrity, calm experience</h2>
          </Reveal>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => <FeatureCard key={f.title} f={f} i={i} />)}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="relative py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-5 grid lg:grid-cols-2 gap-14 items-center">
          <Reveal>
            <div className="text-xs uppercase tracking-[0.2em] text-mint-400 font-medium">Security & privacy</div>
            <h2 className="mt-3 font-display text-3xl lg:text-4xl font-semibold leading-tight">
              Control stays with you.<br />Always.
            </h2>
            <p className="mt-5 text-slate-400 leading-relaxed">
              Rillio is read-only by design. Connecting a wallet never signs a
              transaction; verification uses a short-lived, domain-bound challenge
              with cryptographic ed25519 verification. Sessions are HttpOnly and
              revocable. Corrections and admin actions are audited.
            </p>
            <ul className="mt-7 space-y-3 text-sm">
              {[
                "Never requests seed phrases or private keys",
                "Wallet challenges expire in 5 minutes, one use, domain-bound",
                "Provider credentials encrypted AES-256-GCM",
                "No admin can edit balances — only auditable compensating actions",
                "Provider/RPC failure shows stale data, never empty success",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-slate-300">
                  <CheckCircle2 size={16} className="text-mint-400 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="relative">
              <div className="absolute -inset-6 rounded-[36px] opacity-40 blur-3xl" style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(98,224,181,0.2), transparent 70%)" }} />
              <div className="relative rounded-2xl border border-white/10 bg-ink-800/90 p-6 shadow-2xl shadow-black/40">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-mint-400/15 border border-mint-400/30 flex items-center justify-center">
                    <Shield size={20} className="text-mint-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Wallet challenge</div>
                    <div className="text-[11px] text-slate-500">signed message preview</div>
                  </div>
                  <span className="ml-auto text-[10px] px-2 py-1 rounded-full border border-white/10 text-slate-400">expires 5:00</span>
                </div>
                <pre className="mt-4 rounded-xl bg-ink-950 border border-white/5 p-4 text-[11px] leading-relaxed text-slate-300 font-mono overflow-x-auto">
{`Rillio Wallet Verification
Domain: rillio.app
Purpose: connect_readonly
Nonce: 8f14e45fceea167a… (hashed)
Expires: <timestamp>

This request is read-only. Rillio
will never request a transaction
or a transfer.`}
                </pre>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                  <Lock size={11} className="text-mint-400" />
                  Verified with ed25519 detached signatures (tweetnacl)
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Payments */}
      <section id="payments" className="relative py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-5">
          <Reveal className="text-center max-w-2xl mx-auto">
            <div className="text-xs uppercase tracking-[0.2em] text-mint-400 font-medium">Solana payments</div>
            <h2 className="mt-3 font-display text-3xl lg:text-4xl font-semibold">Pay onchain. No cards, no middlemen.</h2>
            <p className="mt-4 text-slate-400">
              Rillio Plus is settled entirely on Solana. Choose USDC for exact-dollar
              stability, or native SOL quoted at a live oracle price. The server verifies
              the transfer onchain — amount, recipient, reference and finality — before
              Plus unlocks. Browser redirects never grant access.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 md:grid-cols-2 max-w-4xl mx-auto">
            <Reveal>
              <div className="rounded-2xl border border-white/10 bg-ink-800/80 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-aqua-400/15 border border-aqua-400/30 flex items-center justify-center">
                    <Coins size={18} className="text-aqua-400" />
                  </div>
                  <div>
                    <div className="font-semibold">USDC</div>
                    <div className="text-[11px] text-slate-500">exact $8.00 · 6 decimals</div>
                  </div>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  <li className="flex gap-2"><CheckCircle2 size={14} className="text-mint-400 mt-0.5" /> Stable price — no quote drift</li>
                  <li className="flex gap-2"><CheckCircle2 size={14} className="text-mint-400 mt-0.5" /> Mint, amount, recipient & reference all verified</li>
                  <li className="flex gap-2"><CheckCircle2 size={14} className="text-mint-400 mt-0.5" /> Rejected on replay or wrong token</li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="rounded-2xl border border-white/10 bg-ink-800/80 p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-400/15 border border-violet-400/30 flex items-center justify-center">
                    <Wallet size={18} className="text-violet-400" />
                  </div>
                  <div>
                    <div className="font-semibold">Native SOL</div>
                    <div className="text-[11px] text-slate-500">quoted at live oracle price</div>
                  </div>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  <li className="flex gap-2"><CheckCircle2 size={14} className="text-mint-400 mt-0.5" /> Solana Pay reference standard</li>
                  <li className="flex gap-2"><CheckCircle2 size={14} className="text-mint-400 mt-0.5" /> Lamports verified via balance deltas</li>
                  <li className="flex gap-2"><CheckCircle2 size={14} className="text-mint-400 mt-0.5" /> No price source → no quote, honestly</li>
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-5">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs uppercase tracking-[0.2em] text-mint-400 font-medium">Pricing</div>
            <h2 className="mt-3 font-display text-3xl lg:text-4xl font-semibold">Start free. Upgrade onchain.</h2>
          </Reveal>
          <PricingSection onGetStarted={onGetStarted} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-28 border-t border-white/5 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[700px] h-[400px] rounded-full blur-3xl opacity-25"
               style={{ background: "radial-gradient(circle, rgba(197,243,106,0.35), rgba(98,224,181,0.2) 45%, transparent 70%)" }} />
        </div>
        <Reveal className="relative max-w-3xl mx-auto px-5 text-center">
          <RillioMark size={56} className="mx-auto" />
          <h2 className="mt-6 font-display text-3xl lg:text-5xl font-semibold leading-tight">
            Make progress visible.<br />
            <span className="text-gradient-brand">Keep control with you.</span>
          </h2>
          <p className="mt-5 text-slate-400 max-w-xl mx-auto">
            One workspace, real data, honest math. Build your first insight in minutes.
          </p>
          <button
            onClick={onGetStarted}
            className="mt-9 h-13 px-8 py-4 rounded-xl gradient-brand text-ink-950 font-semibold text-lg hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all inline-flex items-center gap-2 shadow-xl shadow-lime-400/25"
          >
            Start your workspace <ArrowRight size={19} />
          </button>
          <p className="mt-5 text-[11px] text-slate-600">
            Working codename · not legal or investment advice · read-only MVP
          </p>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <RillioMark size={22} />
            <span className="text-xs text-slate-500">© {new Date().getFullYear()} Rillio — working codename</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><Globe size={12} /> Solana mainnet</span>
            <span className="flex items-center gap-1.5"><Zap size={12} /> Solana Pay</span>
            <span>Not legal or investment advice</span>
          </div>
        </div>
      </footer>

      {/* Scroll hint */}
      <motion.div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 md:hidden"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.8, repeat: Infinity }}
      >
        <ChevronDown size={20} className="text-slate-500" />
      </motion.div>
    </div>
  );
}
