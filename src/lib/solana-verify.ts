/**
 * Solana wallet signature verification.
 *
 * Per blueprint §4.5 FR-CHAIN-005: verify signature/domain/nonce/expiry/replay.
 *
 * Solana wallets sign messages using ed25519 (the same algorithm used for
 * keypairs). The signature is a 64-byte detached signature over the UTF-8
 * bytes of the message. Verification:
 *   1. Decode wallet address from base58 → 32-byte ed25519 public key
 *   2. Decode signature from base58 or base64 → 64-byte signature
 *   3. Verify with nacl.sign.detached.verify(messageBytes, sigBytes, pubkeyBytes)
 */

import nacl from "tweetnacl";
import base58 from "bs58";

const base58Decode = (s: string): Uint8Array => base58.decode(s);

export type VerifyInput = {
  address: string;
  signature: string; // base58 or base64
  message: string;
};

export type VerifyResult =
  | { ok: true; verified: true; reason: "signature_valid" }
  | { ok: false; verified: false; reason: string; code: string };

/**
 * Verify a Solana wallet signature cryptographically.
 *
 * Returns verified=true only if the signature mathematically matches.
 * Any decoding or verification failure returns verified=false with a code.
 */
export function verifyWalletSignature(input: VerifyInput): VerifyResult {
  const { address, signature, message } = input;

  if (!address || !signature || !message) {
    return { ok: false, verified: false, reason: "Missing address, signature, or message.", code: "MISSING_INPUT" };
  }

  // 1. Decode address (base58) → 32-byte public key
  let publicKeyBytes: Uint8Array;
  try {
    publicKeyBytes = base58Decode(address);
  } catch {
    return { ok: false, verified: false, reason: "Address is not valid base58.", code: "INVALID_ADDRESS" };
  }
  if (publicKeyBytes.length !== 32) {
    return {
      ok: false,
      verified: false,
      reason: `Address must decode to 32 bytes (got ${publicKeyBytes.length}).`,
      code: "INVALID_ADDRESS_LENGTH",
    };
  }

  // 2. Decode signature (base58 first, then base64 fallback)
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base58Decode(signature);
  } catch {
    try {
      signatureBytes = Buffer.from(signature, "base64");
    } catch {
      return {
        ok: false,
        verified: false,
        reason: "Signature is not valid base58 or base64.",
        code: "INVALID_SIGNATURE_ENCODING",
      };
    }
  }
  if (signatureBytes.length !== 64) {
    return {
      ok: false,
      verified: false,
      reason: `Signature must be 64 bytes (got ${signatureBytes.length}).`,
      code: "INVALID_SIGNATURE_LENGTH",
    };
  }

  // 3. Encode message as UTF-8 bytes
  const messageBytes = new TextEncoder().encode(message);

  // 4. Verify with nacl.sign.detached.verify
  let isValid: boolean;
  try {
    isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (e) {
    return {
      ok: false,
      verified: false,
      reason: `Verification threw: ${e instanceof Error ? e.message : "unknown"}`,
      code: "VERIFICATION_ERROR",
    };
  }

  if (!isValid) {
    return {
      ok: false,
      verified: false,
      reason: "Signature does not match this wallet's public key for this message.",
      code: "SIGNATURE_MISMATCH",
    };
  }

  return { ok: true, verified: true, reason: "signature_valid" };
}

/**
 * Check whether signature verification is "enabled" — i.e. the tweetnacl
 * library loaded correctly. In a broken environment, this surfaces honestly.
 */
export function isSignatureVerificationAvailable(): boolean {
  try {
    // Self-test
    const keypair = nacl.sign.keyPair();
    const message = new TextEncoder().encode("test");
    const sig = nacl.sign.detached(message, keypair.secretKey);
    const ok = nacl.sign.detached.verify(message, sig, keypair.publicKey);
    return ok;
  } catch {
    return false;
  }
}
