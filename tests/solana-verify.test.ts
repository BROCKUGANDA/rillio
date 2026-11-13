/**
 * Wallet challenge / signature verification tests — blueprint §4.5 FR-CHAIN-005.
 *
 * Security properties pinned:
 *   - a valid ed25519 signature over the exact challenge message verifies
 *   - a signature from a different key does not
 *   - a signature over a different message does not (domain/nonce binding)
 *   - malformed inputs fail closed with a stable code
 */

import { describe, it, expect } from "vitest";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { verifyWalletSignature, isSignatureVerificationAvailable } from "@/lib/solana-verify";
import { createWalletChallenge, isValidSolanaAddress } from "@/lib/solana";

/** Deterministic keypair for tests (never used for real funds). */
function testKeypair(seed: number) {
  const seedBytes = new Uint8Array(32);
  seedBytes.fill(seed);
  return nacl.sign.keyPair.fromSeed(seedBytes);
}

function signMessage(kp: nacl.SignKeyPair, message: string): string {
  return bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey));
}

describe("verifyWalletSignature", () => {
  it("verifies a correct signature for the exact message", () => {
    const kp = testKeypair(1);
    const address = bs58.encode(kp.publicKey);
    const message = "Rillio Wallet Verification\nNonce: abc123";
    const result = verifyWalletSignature({ address, signature: signMessage(kp, message), message });
    expect(result.ok).toBe(true);
    expect(result.verified).toBe(true);
  });

  it("rejects a signature produced by a different key", () => {
    const kp = testKeypair(1);
    const attacker = testKeypair(2);
    const address = bs58.encode(kp.publicKey);
    const message = "Rillio Wallet Verification\nNonce: abc123";
    const result = verifyWalletSignature({ address, signature: signMessage(attacker, message), message });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("SIGNATURE_MISMATCH");
  });

  it("rejects a valid signature over a different message (nonce binding)", () => {
    const kp = testKeypair(1);
    const address = bs58.encode(kp.publicKey);
    const sig = signMessage(kp, "Rillio Wallet Verification\nNonce: original");
    const result = verifyWalletSignature({ address, signature: sig, message: "Rillio Wallet Verification\nNonce: swapped" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("SIGNATURE_MISMATCH");
  });

  it("fails closed on malformed input rather than throwing", () => {
    const kp = testKeypair(1);
    const address = bs58.encode(kp.publicKey);
    expect(verifyWalletSignature({ address: "", signature: "x", message: "m" }).ok).toBe(false);
    expect(verifyWalletSignature({ address, signature: "", message: "m" }).ok).toBe(false);
    expect(verifyWalletSignature({ address, signature: "x", message: "" }).ok).toBe(false);
  });

  it("rejects an address that is not 32 bytes of base58", () => {
    const kp = testKeypair(1);
    const result = verifyWalletSignature({
      address: bs58.encode(new Uint8Array(16)),
      signature: signMessage(kp, "m"),
      message: "m",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("INVALID_ADDRESS_LENGTH");
  });

  it("rejects a signature of the wrong length", () => {
    const result = verifyWalletSignature({
      address: bs58.encode(testKeypair(1).publicKey),
      signature: bs58.encode(new Uint8Array(10)),
      message: "m",
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("INVALID_SIGNATURE_LENGTH");
  });

  it("passes the nacl self-test in this environment", () => {
    expect(isSignatureVerificationAvailable()).toBe(true);
  });
});

describe("isValidSolanaAddress", () => {
  it("accepts real base58 addresses", () => {
    expect(isValidSolanaAddress("So11111111111111111111111111111111111111112")).toBe(true);
    expect(isValidSolanaAddress("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toBe(true);
  });

  it("rejects junk, empty and over-long values", () => {
    expect(isValidSolanaAddress("")).toBe(false);
    expect(isValidSolanaAddress("not base58!")).toBe(false);
    expect(isValidSolanaAddress("0OIl")).toBe(false);
    expect(isValidSolanaAddress("A".repeat(60))).toBe(false);
  });
});

describe("createWalletChallenge", () => {
  it("produces a unique, expiring, domain-bound message", () => {
    const a = createWalletChallenge({ domain: "rillio.app", purpose: "connect_readonly" });
    const b = createWalletChallenge({ domain: "rillio.app", purpose: "connect_readonly" });

    expect(a.nonce).not.toBe(b.nonce);
    expect(a.message).toContain("Domain: rillio.app");
    expect(a.message).toContain("connect_readonly");
    expect(a.message).toContain(a.nonce);
    expect(a.message).toContain("read-only");
    expect(a.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("honours a custom TTL", () => {
    const c = createWalletChallenge({ domain: "d", purpose: "p", ttlMs: 1000 });
    expect(c.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(1500);
  });
});