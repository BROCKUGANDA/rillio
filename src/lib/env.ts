/**
 * Rillio — runtime environment validation.
 *
 * Per blueprint §22.5 (Phase 2) and STAFF_ENGINEER_IMPLEMENTATION_PROMPT.md
 * Phase 2: "Runtime env validation. Production must fail startup if required
 * secrets are absent."
 *
 * This module never prints values — only variable *names* and whether they are
 * present, plus a safe reason. It is imported by `instrumentation.ts` so that
 * `next build` / `next start` fail closed in production rather than silently
 * booting with a public shared RPC or a missing treasury wallet.
 */

type Requirement = {
  name: string;
  /** What the variable is for — surfaced in the error, never its value. */
  purpose: string;
  /** Required only in production (real secrets/credentials). */
  productionOnly?: boolean;
  /** Reject well-known public/shared endpoints that must not be used in prod. */
  rejectPublicRpc?: boolean;
  /** Validate the shape of the value; return an error reason or null. */
  validate?: (value: string) => string | null;
};

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SOLANA_DEV_RPC_RE = /^https:\/\/(api\.(mainnet-beta|devnet|testnet)\.solana\.com|.*\.(devnet|testnet)\.)/i;

const REQUIREMENTS: Requirement[] = [
  {
    name: "DATABASE_URL",
    purpose: "SQLite connection string for the source-of-truth database.",
  },
  {
    name: "SOLANA_RPC_URL",
    purpose: "Solana JSON-RPC endpoint used for read-only portfolio data.",
    rejectPublicRpc: true,
  },
  {
    name: "SOLANA_CLUSTER",
    purpose: "Cluster the RPC endpoint belongs to (mainnet-beta | devnet | testnet).",
    validate: (v) =>
      ["mainnet-beta", "devnet", "testnet"].includes(v)
        ? null
        : `must be one of mainnet-beta|devnet|testnet (got "${v}").`,
  },
  {
    name: "USDC_RECIPIENT_WALLET",
    purpose: "Treasury wallet that receives USDC subscription payments.",
    validate: (v) =>
      BASE58_RE.test(v) ? null : "must be a valid base58 Solana address.",
  },
  {
    name: "SOL_RECIPIENT_WALLET",
    purpose: "Treasury wallet that receives native SOL subscription payments.",
    validate: (v) =>
      BASE58_RE.test(v) ? null : "must be a valid base58 Solana address.",
  },
  {
    name: "PROVIDER_CREDENTIAL_KEY",
    purpose: "AES-256-GCM key that encrypts provider credentials at rest.",
    productionOnly: true,
    validate: (v) => (v.length >= 16 ? null : "must be at least 16 characters."),
  },
];

export type EnvIssue = {
  name: string;
  problem: string;
  severity: "error" | "warning";
};

export type EnvReport = {
  ok: boolean;
  environment: string;
  isProduction: boolean;
  issues: EnvIssue[];
};

/**
 * Evaluate the environment without throwing. Safe to call from health checks
 * and diagnostics.
 */
export function inspectEnv(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const isProduction = env.NODE_ENV === "production";
  const issues: EnvIssue[] = [];

  for (const req of REQUIREMENTS) {
    const raw = env[req.name];
    const present = typeof raw === "string" && raw.trim().length > 0;

    if (!present) {
      if (isProduction || !req.productionOnly) {
        issues.push({
          name: req.name,
          problem: `is not set. ${req.purpose}`,
          severity: "error",
        });
      }
      continue;
    }

    const value = (raw as string).trim();

    if (req.validate) {
      const reason = req.validate(value);
      if (reason) {
        issues.push({ name: req.name, problem: reason, severity: "error" });
      }
    }

    if (req.rejectPublicRpc && isProduction && SOLANA_DEV_RPC_RE.test(value)) {
      issues.push({
        name: req.name,
        problem:
          "points at a shared/public or non-mainnet Solana endpoint. " +
          "Production must use a dedicated mainnet-beta RPC with an independent fallback.",
        severity: "error",
      });
    }
  }

  // Dev-only convenience: a dev fallback credential key is acceptable locally
  // but must never reach production (already an error above when unset).
  if (isProduction && !env.PROVIDER_CREDENTIAL_KEY) {
    // already reported; nothing further to add
  }

  return {
    ok: issues.every((i) => i.severity !== "error"),
    environment: env.NODE_ENV ?? "development",
    isProduction,
    issues,
  };
}

/**
 * Throw a single aggregated error when the environment is not valid for the
 * current mode. Call this from `instrumentation.ts` (once per server boot) so
 * production never starts in an unsafe or fabricated state.
 */
export function assertEnvOrThrow(env: NodeJS.ProcessEnv = process.env): EnvReport {
  const report = inspectEnv(env);
  if (report.ok) return report;

  const lines = report.issues.map((i) => `  - [${i.severity}] ${i.name}: ${i.problem}`);
  throw new Error(
    `Refusing to start: invalid environment configuration (${report.environment}).\n` +
      lines.join("\n") +
      "\nSet these variables (see .env.example). Values are never logged.",
  );
}