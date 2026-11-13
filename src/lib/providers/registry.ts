/**
 * Provider registry.
 *
 * Maps provider codes to BankProvider implementations. Add new providers here
 * as they are integrated (Plaid, Teller, MX, GoCardless, etc.).
 *
 * Per blueprint §4.2 FR-DATA-003 and "no fake functionality" rule:
 *   - Each provider's `isAvailable` flag reflects whether real credentials are configured
 *   - The Demo provider is always available (clearly-labelled synthetic data)
 *   - Real providers only appear as available when their API keys are configured
 */

import type { BankProvider, ProviderInfo } from "./types";
import { demoProvider } from "./demo-provider";
import { randomBytes, createCipheriv, createDecipheriv, createHash } from "crypto";

const REGISTRY: Record<string, BankProvider> = {
  demo: demoProvider,
  // Future: plaid, teller, mx, gocardless, mono, okra, etc.
};

/**
 * List all providers with their availability status for the UI.
 */
export function listProviders(): ProviderInfo[] {
  return Object.values(REGISTRY).map((p) => {
    const info = { ...p.info };
    // Real providers gate on env vars
    if (info.code === "plaid") {
      info.isAvailable = !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
      info.availabilityNote = info.isAvailable
        ? undefined
        : "Plaid credentials not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.";
    }
    return info;
  });
}

export function getProvider(code: string): BankProvider | null {
  return REGISTRY[code] ?? null;
}

/**
 * Simple credential encryption using AES-256-GCM with a per-environment key.
 * In production, keys come from a KMS / secret manager.
 */
export function encryptCredential(plaintext: string): { ciphertext: string; iv: string; algorithm: string } {
  const key = getCredentialKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Pack ciphertext + auth tag together
  const packed = Buffer.concat([encrypted, tag]).toString("base64");
  return { ciphertext: packed, iv: iv.toString("base64"), algorithm: "aes-256-gcm" };
}

export function decryptCredential(ref: { ciphertext: string; iv: string; algorithm: string }): string {
  const key = getCredentialKey();
  const packed = Buffer.from(ref.ciphertext, "base64");
  const tag = packed.subarray(packed.length - 16);
  const encrypted = packed.subarray(0, packed.length - 16);
  const iv = Buffer.from(ref.iv, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function getCredentialKey(): Buffer {
  // Derive a 32-byte key from env var (or a fixed dev fallback)
  const secret = process.env.PROVIDER_CREDENTIAL_KEY || "rillio-dev-credential-key-32bytes!!";
  return createHash("sha256").update(secret).digest();
}
