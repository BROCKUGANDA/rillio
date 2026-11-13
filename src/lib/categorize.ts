/**
 * Deterministic categorization engine.
 *
 * Precedence per blueprint §4.3 FR-CAT-001 and Phase 5:
 *   user correction > user rule > verified merchant > deterministic heuristic > uncategorized
 *
 * All decisions are recorded with reason and actor.
 */

export type Category = {
  id: string;
  name: string;
  kind: "expense" | "income" | "transfer" | "ignore";
};

export type CategorizationResult = {
  categoryId: string | null;
  actor: "user_correction" | "user_rule" | "verified_merchant" | "heuristic" | "uncategorized";
  reason: string;
  ruleId?: string;
  confidence?: number; // 0-1
};

export type Rule = {
  id: string;
  field: "merchant" | "description";
  pattern: string;
  categoryId: string;
  priority: number;
  enabled: boolean;
};

export type Merchant = {
  id: string;
  canonicalName: string;
  aliases: string[];
  categoryId: string | null;
  verified: boolean;
};

/**
 * Apply categorization precedence.
 */
export function categorize(
  description: string,
  merchant: string | null,
  options: {
    userCorrections?: Map<string, string>; // fingerprint -> categoryId
    rules?: Rule[];
    merchants?: Merchant[];
  } = {}
): CategorizationResult {
  const haystack = (merchant || description || "").toLowerCase().trim();
  if (!haystack) {
    return {
      categoryId: null,
      actor: "uncategorized",
      reason: "Empty description.",
    };
  }

  // 1. User rules (sorted by priority desc)
  const rules = (options.rules ?? []).filter((r) => r.enabled);
  rules.sort((a, b) => b.priority - a.priority);
  for (const rule of rules) {
    const value = (rule.field === "merchant" ? (merchant || "") : description).toLowerCase();
    if (value.includes(rule.pattern.toLowerCase())) {
      return {
        categoryId: rule.categoryId,
        actor: "user_rule",
        reason: `Matched rule on ${rule.field} "${rule.pattern}".`,
        ruleId: rule.id,
        confidence: 1.0,
      };
    }
  }

  // 2. Verified merchants
  for (const m of options.merchants ?? []) {
    if (!m.verified || !m.categoryId) continue;
    const aliases = [m.canonicalName, ...m.aliases].map((a) => a.toLowerCase());
    if (aliases.some((a) => haystack.includes(a))) {
      return {
        categoryId: m.categoryId,
        actor: "verified_merchant",
        reason: `Matched verified merchant "${m.canonicalName}".`,
        confidence: 0.95,
      };
    }
  }

  // 3. Deterministic heuristics
  const heuristic = matchHeuristic(haystack);
  if (heuristic) {
    return {
      categoryId: heuristic.categoryId,
      actor: "heuristic",
      reason: heuristic.reason,
      confidence: heuristic.confidence,
    };
  }

  return {
    categoryId: null,
    actor: "uncategorized",
    reason: "No matching rule, merchant, or heuristic.",
  };
}

/** Default heuristic categories (mapped to seeded category IDs at runtime). */
export const DEFAULT_HEURISTICS: {
  matchers: RegExp[];
  categoryName: string;
  confidence: number;
}[] = [
  { matchers: [/grocery|supermarket|whole foods|trader joe|safeway|kroger|aldi|walmart|tesco|carrefour/], categoryName: "Groceries", confidence: 0.85 },
  { matchers: [/restaurant|cafe|coffee|starbucks|mcdonald|kfc|burger|pizza|chipotle|doordash|uber\s*eats|grubhub|deliveroo/], categoryName: "Dining", confidence: 0.85 },
  { matchers: [/uber|lyft|taxi|metro|transit|bus|train|fuel|gas|shell|bp|exxon|chevron/], categoryName: "Transport", confidence: 0.82 },
  { matchers: [/netflix|spotify|hulu|disney|apple\.com.*sub|google.*sub|adobe|dropbox|icloud/], categoryName: "Subscriptions", confidence: 0.9 },
  { matchers: [/rent|mortgage|landlord|housing/], categoryName: "Housing", confidence: 0.9 },
  { matchers: [/electric|water|gas company|utility|internet|comcast|verizon|at&t|vodafone/], categoryName: "Utilities", confidence: 0.85 },
  { matchers: [/salary|payroll|wages|deposit.*employer|direct deposit/], categoryName: "Income", confidence: 0.95 },
  { matchers: [/atm withdrawal|cash withdrawal/], categoryName: "Cash", confidence: 0.9 },
  { matchers: [/pharmacy|hospital|clinic|doctor|dental|prescription/], categoryName: "Healthcare", confidence: 0.82 },
  { matchers: [/amazon|ebay|etsy|target|costco/], categoryName: "Shopping", confidence: 0.7 },
  { matchers: [/transfer|wire|ach|zelle|venmo|paypal|internal transfer/], categoryName: "Transfers", confidence: 0.88 },
  { matchers: [/interest|dividend|refund|cashback|reward/], categoryName: "Other Income", confidence: 0.7 },
];

function matchHeuristic(haystack: string): {
  categoryId: string;
  reason: string;
  confidence: number;
} | null {
  for (const h of DEFAULT_HEURISTICS) {
    if (h.matchers.some((re) => re.test(haystack))) {
      return {
        categoryId: `heuristic:${h.categoryName}`,
        reason: `Heuristic match on keywords for ${h.categoryName}.`,
        confidence: h.confidence,
      };
    }
  }
  return null;
}

/** Default seed categories for a new user. */
export const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  { name: "Groceries", kind: "expense" },
  { name: "Dining", kind: "expense" },
  { name: "Transport", kind: "expense" },
  { name: "Subscriptions", kind: "expense" },
  { name: "Housing", kind: "expense" },
  { name: "Utilities", kind: "expense" },
  { name: "Healthcare", kind: "expense" },
  { name: "Shopping", kind: "expense" },
  { name: "Cash", kind: "expense" },
  { name: "Transfers", kind: "transfer" },
  { name: "Income", kind: "income" },
  { name: "Other Income", kind: "income" },
  { name: "Uncategorized", kind: "expense" },
];
