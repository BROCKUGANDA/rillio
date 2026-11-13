/**
 * Goal projection domain logic — blueprint §4.4 FR-GOAL-002/003.
 *
 * Deterministic, versioned, exact (BigInt minor units), and explicitly
 * non-guaranteed. A projection is a *plan*, never a custody record: this module
 * never touches balances, holds, or transfers.
 *
 * Extracted from the simulate route so the math is unit-testable and there is a
 * single definition of "projected".
 */

import type { Minor } from "./money";

export type Cadence = "weekly" | "biweekly" | "monthly";

export type ProjectionInput = {
  /** Amount already set aside (user-entered, labelled as such). */
  startingAmountMinor: Minor;
  /** Planned contribution per cadence period. */
  plannedContributionMinor: Minor;
  cadence: Cadence;
  targetMinor: Minor;
  /** Inclusive target date. Defaults to 12 months from `from` when omitted. */
  targetDate?: Date | null;
  /** Annualised illustrative return, e.g. 0.04 = 4%. Omit for no-yield. */
  assumedReturnRate?: number | null;
  /** Reference "now" (injectable for deterministic tests). */
  from?: Date;
};

export type ProjectionPoint = {
  month: number;
  label: string;
  contributionMinor: string;
  projectedMinor: string;
};

export type Projection = {
  months: number;
  perMonthMinor: string;
  startingAmountMinor: string;
  projectedAmountMinor: string;
  targetMinor: string;
  reachesTarget: boolean;
  shortfallMinor: string;
  assumedReturnRate: number | null;
  warning: string;
  disclaimer: string;
  schedule: ProjectionPoint[];
};

/** Contributions per calendar month for a cadence. */
export function contributionsPerMonth(cadence: Cadence): number {
  switch (cadence) {
    case "weekly":
      return 4;
    case "biweekly":
      return 2;
    case "monthly":
    default:
      return 1;
  }
}

/** Whole calendar months from `from` to `to` (never negative). */
export function monthsBetween(from: Date, to: Date): number {
  const total = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  return Math.max(0, total);
}

/**
 * Deterministic projection. Returns a plan, not a balance.
 *
 * Uses exact integer arithmetic throughout: the assumed return is applied as
 * basis points so no float ever enters the calculation.
 */
export function projectGoal(input: ProjectionInput): Projection {
  const from = input.from ?? new Date();
  const end = input.targetDate ?? new Date(Date.UTC(from.getUTCFullYear() + 1, from.getUTCMonth(), 1));
  const months = monthsBetween(from, end);

  const perMonth = input.plannedContributionMinor * BigInt(contributionsPerMonth(input.cadence));

  const useAssumedReturn =
    typeof input.assumedReturnRate === "number" &&
    Number.isFinite(input.assumedReturnRate) &&
    input.assumedReturnRate > 0 &&
    input.assumedReturnRate < 0.5;

  // Monthly growth factor as basis points: (1200 + bps) / 1200.
  const monthlyBps = useAssumedReturn
    ? Math.round((input.assumedReturnRate as number) * 1200 * 12) / 12
    : 0;

  let projected: Minor = input.startingAmountMinor;
  const schedule: ProjectionPoint[] = [];

  for (let m = 0; m <= months; m++) {
    if (m > 0) {
      projected += perMonth;
      if (useAssumedReturn && monthlyBps > 0) {
        projected = (projected * BigInt(1200 + monthlyBps)) / 1200n;
      }
    }
    schedule.push({
      month: m,
      label: new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + m, 1))
        .toISOString()
        .slice(0, 7),
      contributionMinor: perMonth.toString(),
      projectedMinor: projected.toString(),
    });
  }

  const reachesTarget = projected >= input.targetMinor;
  const shortfall = reachesTarget ? 0n : input.targetMinor - projected;

  return {
    months,
    perMonthMinor: perMonth.toString(),
    startingAmountMinor: input.startingAmountMinor.toString(),
    projectedAmountMinor: projected.toString(),
    targetMinor: input.targetMinor.toString(),
    reachesTarget,
    shortfallMinor: shortfall.toString(),
    assumedReturnRate: useAssumedReturn ? input.assumedReturnRate ?? null : null,
    warning: useAssumedReturn
      ? "Illustrative scenario with assumed return. Not guaranteed. Past performance does not predict future results."
      : "Projection assumes no investment return. Actual outcomes depend on where funds are held.",
    disclaimer: "Planned allocations are not held funds. Rillio does not custody money in MVP.",
    schedule,
  };
}