/**
 * Goal projection tests — blueprint §4.4 FR-GOAL-002/003.
 *
 * Pins: deterministic + exact arithmetic, no implicit yield, explicit and
 * labelled assumptions, and that a projection is a plan (never held funds).
 */

import { describe, it, expect } from "vitest";
import { projectGoal, contributionsPerMonth, monthsBetween } from "@/lib/goals";

const FROM = new Date(Date.UTC(2024, 0, 1)); // 2024-01-01

describe("contributionsPerMonth", () => {
  it("maps cadences to monthly contribution counts", () => {
    expect(contributionsPerMonth("weekly")).toBe(4);
    expect(contributionsPerMonth("biweekly")).toBe(2);
    expect(contributionsPerMonth("monthly")).toBe(1);
  });
});

describe("monthsBetween", () => {
  it("counts whole calendar months and never goes negative", () => {
    expect(monthsBetween(new Date(Date.UTC(2024, 0, 1)), new Date(Date.UTC(2024, 11, 1)))).toBe(11);
    expect(monthsBetween(new Date(Date.UTC(2024, 0, 1)), new Date(Date.UTC(2023, 0, 1)))).toBe(0);
  });
});

describe("projectGoal", () => {
  it("assumes no yield by default", () => {
    const p = projectGoal({
      startingAmountMinor: 0n,
      plannedContributionMinor: 10000n, // $100.00
      cadence: "monthly",
      targetMinor: 120000n,
      targetDate: new Date(Date.UTC(2025, 0, 1)),
      from: FROM,
    });
    expect(p.months).toBe(12);
    expect(p.projectedAmountMinor).toBe("120000"); // 12 × $100, no growth
    expect(p.assumedReturnRate).toBeNull();
    expect(p.warning).toMatch(/no investment return/i);
  });

  it("is deterministic for identical input", () => {
    const input = {
      startingAmountMinor: 5000n,
      plannedContributionMinor: 2500n,
      cadence: "monthly" as const,
      targetMinor: 100000n,
      targetDate: new Date(Date.UTC(2025, 5, 1)),
      from: FROM,
    };
    const a = projectGoal(input);
    const b = projectGoal(input);
    expect(a).toEqual(b);
  });

  it("applies an explicitly supplied return with exact integer math", () => {
    const p = projectGoal({
      startingAmountMinor: 0n,
      plannedContributionMinor: 10000n,
      cadence: "monthly",
      targetMinor: 1000000n,
      targetDate: new Date(Date.UTC(2025, 0, 1)),
      assumedReturnRate: 0.12, // 12% annual, explicitly opted in
      from: FROM,
    });
    expect(p.assumedReturnRate).toBe(0.12);
    expect(p.warning).toMatch(/not guaranteed/i);
    // Compounding at 1% monthly must exceed the no-yield baseline of 120000.
    expect(BigInt(p.projectedAmountMinor) > 120000n).toBe(true);
  });

  it("ignores an out-of-range return rather than trusting it", () => {
    const p = projectGoal({
      startingAmountMinor: 0n,
      plannedContributionMinor: 10000n,
      cadence: "monthly",
      targetMinor: 1000000n,
      targetDate: new Date(Date.UTC(2025, 0, 1)),
      assumedReturnRate: 5, // 500% — not a plausible annual rate
      from: FROM,
    });
    expect(p.assumedReturnRate).toBeNull();
    expect(p.warning).toMatch(/no investment return/i);
  });

  it("reports the shortfall honestly when the plan misses the target", () => {
    const p = projectGoal({
      startingAmountMinor: 0n,
      plannedContributionMinor: 1000n, // $10.00/month
      cadence: "monthly",
      targetMinor: 500000n, // $5,000 target
      targetDate: new Date(Date.UTC(2025, 0, 1)),
      from: FROM,
    });
    expect(p.reachesTarget).toBe(false);
    expect(p.shortfallMinor).toBe("488000");
  });

  it("scales weekly cadence by four contributions per month", () => {
    const p = projectGoal({
      startingAmountMinor: 0n,
      plannedContributionMinor: 2500n, // $25.00/week
      cadence: "weekly",
      targetMinor: 100000n,
      targetDate: new Date(Date.UTC(2024, 11, 1)),
      from: FROM,
    });
    expect(p.perMonthMinor).toBe("10000"); // $100/month
    expect(p.projectedAmountMinor).toBe("110000"); // 11 months × $100
  });

  it("never describes a plan as held funds", () => {
    const p = projectGoal({
      startingAmountMinor: 1000n,
      plannedContributionMinor: 1000n,
      cadence: "monthly",
      targetMinor: 10000n,
      targetDate: new Date(Date.UTC(2025, 0, 1)),
      from: FROM,
    });
    expect(p.disclaimer).toMatch(/not held funds/i);
    expect(p.disclaimer).toMatch(/does not custody/i);
  });

  it("emits a schedule covering every projected month", () => {
    const p = projectGoal({
      startingAmountMinor: 0n,
      plannedContributionMinor: 1000n,
      cadence: "monthly",
      targetMinor: 100000n,
      targetDate: new Date(Date.UTC(2024, 5, 1)),
      from: FROM,
    });
    expect(p.schedule).toHaveLength(6); // months 0..5 inclusive
    expect(p.schedule[0].label).toBe("2024-01");
    expect(p.schedule[5].label).toBe("2024-06");
  });
});