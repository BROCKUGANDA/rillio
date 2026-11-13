/**
 * Categorization precedence tests — blueprint §4.3 FR-CAT-001, Phase 5.
 *
 * Precedence: user correction > user rule > verified merchant >
 * deterministic heuristic > uncategorized. Every decision must carry an actor
 * and a reason so the UI can explain it.
 */

import { describe, it, expect } from "vitest";
import { categorize, type Rule, type Merchant } from "@/lib/categorize";

const rules: Rule[] = [
  { id: "r-low", field: "description", pattern: "starbucks", categoryId: "cat-dining", priority: 10, enabled: true },
  { id: "r-high", field: "merchant", pattern: "STARBUCKS", categoryId: "cat-coffee", priority: 900, enabled: true },
  { id: "r-disabled", field: "description", pattern: "starbucks", categoryId: "cat-off", priority: 999, enabled: false },
];

const merchants: Merchant[] = [
  { id: "m1", canonicalName: "Whole Foods Market", aliases: ["whole foods", "wholefoods"], categoryId: "cat-groceries", verified: true },
  { id: "m2", canonicalName: "Unverified Co", aliases: ["unverified co"], categoryId: "cat-nope", verified: false },
];

describe("categorize precedence", () => {
  it("lets a user rule win over a deterministic heuristic", () => {
    const res = categorize("STARBUCKS STORE #123", "STARBUCKS", { rules, merchants });
    expect(res.categoryId).toBe("cat-coffee");
    expect(res.actor).toBe("user_rule");
    expect(res.ruleId).toBe("r-high");
    expect(res.confidence).toBe(1);
  });

  it("ignores disabled rules", () => {
    const onlyDisabled = rules.filter((r) => r.enabled);
    const res = categorize("starbucks", "starbucks", { rules: onlyDisabled });
    // Highest-priority enabled rule is r-high (merchant match)
    expect(res.actor).toBe("user_rule");
    expect(res.ruleId).toBe("r-high");
  });

  it("uses a verified merchant mapping when no rule matches", () => {
    const res = categorize("WHOLEFDS MKT #10", "Whole Foods Market", { rules: [], merchants });
    expect(res.categoryId).toBe("cat-groceries");
    expect(res.actor).toBe("verified_merchant");
    expect(res.confidence).toBe(0.95);
  });

  it("never trusts an unverified merchant", () => {
    const res = categorize("unverified co purchase", "Unverified Co", { rules: [], merchants });
    expect(res.categoryId).not.toBe("cat-nope");
  });

  it("falls back to a deterministic heuristic with a confidence label", () => {
    const res = categorize("NETFLIX.COM MONTHLY", null, { rules: [], merchants: [] });
    expect(res.actor).toBe("heuristic");
    expect(res.confidence).toBeGreaterThan(0);
    expect(res.confidence).toBeLessThanOrEqual(1);
  });

  it("returns uncategorized (not a guess) when nothing matches", () => {
    const res = categorize("ZZZ UNKNOWN VENDOR 998877", null, { rules: [], merchants: [] });
    expect(res.categoryId).toBeNull();
    expect(res.actor).toBe("uncategorized");
    expect(res.reason).toMatch(/no matching/i);
  });

  it("handles an empty description without throwing", () => {
    const res = categorize("", null, { rules: [], merchants: [] });
    expect(res.categoryId).toBeNull();
    expect(res.actor).toBe("uncategorized");
  });

  it("is deterministic for the same input", () => {
    const a = categorize("UBER TRIP", null, { rules: [], merchants: [] });
    const b = categorize("UBER TRIP", null, { rules: [], merchants: [] });
    expect(a).toEqual(b);
  });
});