/**
 * Environment validation tests — blueprint §22.5 (Phase 2).
 *
 * "Production must fail startup if required secrets are absent." These tests
 * pin that guarantee plus the rule that shared/public Solana RPC endpoints are
 * rejected in production.
 */

import { describe, it, expect } from "vitest";
import { inspectEnv, assertEnvOrThrow } from "@/lib/env";

const VALID_BASE58 = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function baseEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "file:./db/custom.db",
    SOLANA_RPC_URL: "https://solana-mainnet.example-dedicated-rpc.com",
    SOLANA_CLUSTER: "mainnet-beta",
    USDC_RECIPIENT_WALLET: VALID_BASE58,
    SOL_RECIPIENT_WALLET: VALID_BASE58,
    PROVIDER_CREDENTIAL_KEY: "a-sufficiently-long-secret-value",
  } as NodeJS.ProcessEnv;
}

describe("inspectEnv", () => {
  it("passes a complete production environment", () => {
    const report = inspectEnv(baseEnv());
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it("fails production when a required secret is missing", () => {
    const env = baseEnv();
    delete env.PROVIDER_CREDENTIAL_KEY;
    const report = inspectEnv(env);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.name === "PROVIDER_CREDENTIAL_KEY")).toBe(true);
  });

  it("rejects the shared public Solana RPC in production", () => {
    const env = baseEnv();
    env.SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
    const report = inspectEnv(env);
    expect(report.ok).toBe(false);
    const rpc = report.issues.find((i) => i.name === "SOLANA_RPC_URL");
    expect(rpc).toBeDefined();
    expect(rpc?.problem).toMatch(/shared\/public/i);
  });

  it("rejects a non-mainnet cluster value", () => {
    const env = baseEnv();
    env.SOLANA_CLUSTER = "banana";
    const report = inspectEnv(env);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.name === "SOLANA_CLUSTER")).toBe(true);
  });

  it("rejects a malformed treasury wallet address", () => {
    const env = baseEnv();
    env.USDC_RECIPIENT_WALLET = "not-a-valid-address";
    const report = inspectEnv(env);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.name === "USDC_RECIPIENT_WALLET")).toBe(true);
  });

  it("allows the credential key to be absent outside production", () => {
    const env = baseEnv();
    env.NODE_ENV = "development";
    delete env.PROVIDER_CREDENTIAL_KEY;
    const report = inspectEnv(env);
    expect(report.ok).toBe(true);
  });

  it("never includes values in its output", () => {
    const env = baseEnv();
    const report = inspectEnv(env);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("a-sufficiently-long-secret-value");
    expect(serialized).not.toContain(VALID_BASE58);
  });
});