/**
 * Solana read-only portfolio boundary.
 *
 * Per blueprint §14, §4.5, Phase 6:
 *   - Never request key material. No custody. No transfers in MVP.
 *   - Production must use a real RPC endpoint (not public shared).
 *   - RPC failure is stale, never zero.
 *   - Unknown/unpriced/spam tokens are labelled, not silently excluded.
 *
 * In this MVP environment, if no RPC endpoint is configured, the client
 * surfaces an honest "boundary" state — it does NOT fabricate balances.
 */

export type SolanaConfig = {
  rpcUrl: string | null;
  cluster: "devnet" | "mainnet-beta" | "testnet";
};

export function getSolanaConfig(): SolanaConfig {
  const rpcUrl = process.env.SOLANA_RPC_URL || null;
  const cluster =
    (process.env.SOLANA_CLUSTER as SolanaConfig["cluster"]) || "devnet";
  return { rpcUrl, cluster };
}

export type BoundaryState =
  | { kind: "ok"; rpcUrl: string; cluster: string }
  | {
      kind: "not_configured";
      reason: string;
      guidance: string;
    };

/**
 * Honest boundary check. UI must surface the not_configured state clearly
 * rather than silently substituting mock balances.
 */
export function checkSolanaBoundary(): BoundaryState {
  const cfg = getSolanaConfig();
  if (!cfg.rpcUrl) {
    return {
      kind: "not_configured",
      reason:
        "No Solana RPC endpoint is configured for this environment.",
      guidance:
        "Connect a wallet to verify ownership. Portfolio balances require a real RPC endpoint to be configured by an operator before they can be displayed. Rillio never fabricates onchain balances.",
    };
  }
  return { kind: "ok", rpcUrl: cfg.rpcUrl, cluster: cfg.cluster };
}

/**
 * Generate a short-lived, domain-bound wallet challenge.
 * Per blueprint §4.5 FR-CHAIN-005: hashed nonce, replay/wrong-domain/expired rejected.
 */
export function createWalletChallenge(opts: {
  domain: string;
  purpose: string;
  ttlMs?: number;
}): { nonce: string; message: string; expiresAt: Date } {
  const ttlMs = opts.ttlMs ?? 1000 * 60 * 5; // 5 min
  const nonce = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMs);
  const message = [
    "Rillio Wallet Verification",
    `Domain: ${opts.domain}`,
    `Purpose: ${opts.purpose}`,
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt.toISOString()}`,
    "",
    "This request is read-only. Rillio will never request a transaction or transfer.",
  ].join("\n");
  return { nonce, message, expiresAt };
}

// Inline import to avoid top-level crypto import collision
import { randomBytes } from "crypto";

/**
 * Verify a signed challenge. In MVP without an onchain library configured,
 * we accept the connection but mark the wallet as "unverified" and surface
 * that state clearly in the UI. A verified path would call
 * nacl.sign.detached.verify with the wallet's public key.
 *
 * For now, this returns verification=false and the UI shows an explicit
 * "Signature verification not configured" badge rather than fabricating trust.
 */
export type VerifyResult =
  | { ok: true; address: string; verified: true }
  | { ok: true; address: string; verified: false; reason: string }
  | { ok: false; reason: string };

export function verifyWalletSignature(opts: {
  address: string;
  signature: string | null;
  expectedNonce: string;
  expectedDomain: string;
}): VerifyResult {
  if (!opts.address) {
    return { ok: false, reason: "Missing wallet address." };
  }
  // In a fully wired MVP we would verify the signature cryptographically.
  // Until that path is configured, we accept the connection but DO NOT
  // mark it as verified. The UI must surface this honestly.
  return {
    ok: true,
    address: opts.address,
    verified: false,
    reason:
      "Cryptographic signature verification is not enabled in this environment. Wallet is connected for read-only indexing but not verified as owned by the user.",
  };
}

/**
 * Validate a Solana address format (base58, ~32-44 chars).
 * This is a format check only, not a chain lookup.
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!address) return false;
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}
