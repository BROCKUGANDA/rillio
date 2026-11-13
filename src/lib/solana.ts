/**
 * Solana read-only portfolio boundary.
 *
 * Per blueprint §14, §4.5, Phase 6:
 *   - Never request key material. No custody. No transfers in MVP.
 *   - Production must use a real RPC endpoint (not public shared).
 *   - RPC failure is stale, never zero.
 *   - Unknown/unpriced/spam tokens are labelled, not silently excluded.
 *
 * Signature verification is now wired (lib/solana-verify.ts).
 * RPC queries are wired (lib/solana-rpc.ts).
 */

import { verifyWalletSignature as realVerifySignature, type VerifyResult as RealVerifyResult } from "./solana-verify";

export type SolanaConfig = {
  rpcUrl: string | null;
  cluster: "devnet" | "mainnet-beta" | "testnet";
};

export function getSolanaConfig(): SolanaConfig {
  const rpcUrl = process.env.SOLANA_RPC_URL || null;
  const cluster =
    (process.env.SOLANA_CLUSTER as SolanaConfig["cluster"]) || "mainnet-beta";
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
  const nonce = randomBytesHex(32);
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

/**
 * Verify a signed challenge. Now delegates to lib/solana-verify.ts which
 * performs real ed25519 verification via tweetnacl.
 *
 * If no signature is provided (e.g. browser doesn't have a signer wired),
 * we return verified=false with a clear reason. The wallet is still saved
 * but marked unverified.
 */
export type VerifyResult =
  | { ok: true; address: string; verified: true; reason: "signature_valid" }
  | { ok: true; address: string; verified: false; reason: string; code: string }
  | { ok: false; reason: string; code: string };

export function verifyWalletSignature(opts: {
  address: string;
  signature: string | null;
  message: string;
}): VerifyResult {
  if (!opts.address) {
    return { ok: false, reason: "Missing wallet address.", code: "MISSING_ADDRESS" };
  }

  // If signature absent, accept connection as unverified
  if (!opts.signature) {
    return {
      ok: true,
      address: opts.address,
      verified: false,
      reason: "No signature provided. Wallet connected as unverified.",
      code: "NO_SIGNATURE",
    };
  }

  // Delegate to real cryptographic verification (lib/solana-verify.ts)
  const result = realVerifySignature({
    address: opts.address,
    signature: opts.signature,
    message: opts.message,
  });

  if (!result.ok) {
    return {
      ok: true, // We still accept the connection
      address: opts.address,
      verified: false,
      reason: result.reason,
      code: result.code ?? "VERIFICATION_FAILED",
    };
  }

  return {
    ok: true,
    address: opts.address,
    verified: true,
    reason: "signature_valid",
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

function randomBytesHex(n: number): string {
  const bytes = new Uint8Array(n);
  // Use crypto.getRandomValues in browser-ish environments, or Node crypto
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require("crypto");
    const buf = nodeCrypto.randomBytes(n);
    bytes.set(buf);
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
