/**
 * Rillio brand marks and custom glyphs.
 *
 * Per blueprint §8.6: Lucide as baseline + 7 custom Rillio glyphs
 * (Flow, Goal, Orbit, Pulse, Source, Shield, Spark).
 * All glyphs use a consistent 1.75px stroke, 20/24px sizing.
 */

type IconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

const baseProps = (size: number, strokeWidth: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
  "aria-hidden": true,
});

/** Flow — two joined curves (cash flow). */
export function FlowIcon({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      <path d="M3 8c3-3 6-3 9 0s6 3 9 0" />
      <path d="M3 16c3-3 6-3 9 0s6 3 9 0" />
    </svg>
  );
}

/** Goal — concentric arc + endpoint. */
export function GoalIcon({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M12 3a9 9 0 0 1 0 18" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Orbit — ring + dot (portfolio/ownership). */
export function OrbitIcon({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      <circle cx="12" cy="12" r="3.2" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(0 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)" />
    </svg>
  );
}

/** Pulse — three-step waveform. */
export function PulseIcon({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      <path d="M3 12h3l2-6 4 12 2-6h7" />
    </svg>
  );
}

/** Source — document corner + link node. */
export function SourceIcon({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      <path d="M5 3h10l4 4v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
      <circle cx="9" cy="15" r="1.5" fill="currentColor" stroke="none" />
      <path d="M10.5 15h5M13.5 15v3" />
    </svg>
  );
}

/** Shield — rounded shield with river line. */
export function ShieldIcon({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      <path d="M12 3 5 6v5c0 5 3.2 8.4 7 9.5C15.8 19.4 19 16 19 11V6l-7-3z" />
      <path d="M9 11c1.5-1 3.5-1 5 .5s2 3.5.5 5" opacity="0.6" />
    </svg>
  );
}

/** Spark — four-point spark (milestone, use sparingly). */
export function SparkIcon({ size = 20, className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      <path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18" opacity="0.45" />
      <path d="M12 7l1.5 3.5L17 12l-3.5 1.5L12 17l-1.5-3.5L7 12l3.5-1.5L12 7z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Rillio brand mark — abstract flowing R ribbon. */
export function RillioMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rillio-mark-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C5F36A" />
          <stop offset="1" stopColor="#62E0B5" />
        </linearGradient>
      </defs>
      <g
        fill="none"
        stroke="url(#rillio-mark-grad)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 38 C20 24 28 18 40 18 H50 C56 18 60 22 60 28 C60 34 56 38 50 38 H40 C34 38 30 41 27 47 L22 56" />
        <path d="M30 38 C36 38 41 41 45 46 L52 56" />
      </g>
    </svg>
  );
}

/** Rillio horizontal wordmark. */
export function RillioWordmark({
  size = 28,
  withMark = true,
  className,
}: {
  size?: number;
  withMark?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      {withMark && <RillioMark size={size} />}
      <span
        className="font-display font-semibold tracking-[0.18em] text-paper-100"
        style={{ fontSize: size * 0.62 }}
      >
        RILLIO
      </span>
    </span>
  );
}
