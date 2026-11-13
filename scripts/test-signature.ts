/**
 * Test that ed25519 signature verification works.
 * Generates a keypair, signs a message, verifies it.
 */
import nacl from "tweetnacl";
import base58 from "bs58";
import { verifyWalletSignature } from "../src/lib/solana-verify";

async function main() {
  // Generate a test keypair
  const keypair = nacl.sign.keyPair();
  const address = base58.encode(keypair.publicKey);
  const message = "Rillio Wallet Verification\nDomain: test\nPurpose: connect_readonly\nNonce: abc123";

  // Sign the message
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signatureBase58 = base58.encode(signature);

  console.log("Address:", address);
  console.log("Signature (base58):", signatureBase58.slice(0, 20) + "...");

  // Verify with our verifier
  const result = verifyWalletSignature({
    address,
    signature: signatureBase58,
    message,
  });
  console.log("Verification result:", result);

  // Try with wrong message
  const wrongResult = verifyWalletSignature({
    address,
    signature: signatureBase58,
    message: "different message",
  });
  console.log("Wrong message result:", wrongResult);

  // Try with wrong address
  const wrongAddressResult = verifyWalletSignature({
    address: base58.encode(nacl.sign.keyPair().publicKey),
    signature: signatureBase58,
    message,
  });
  console.log("Wrong address result:", wrongAddressResult);
}

main().catch(console.error);
