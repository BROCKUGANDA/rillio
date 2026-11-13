/**
 * Money arithmetic tests — blueprint §4.2 FR-DATA-004, §11.2.
 *
 * The core invariant: no float arithmetic anywhere in the money path. These
 * tests pin exact integer behaviour across the locale/sign conventions that
 * real bank CSVs use, plus the boundary cases the blueprint calls out.
 */

import { describe, it, expect } from "vitest";
import {
  parseDecimalToMinor,
  formatMinor,
  formatTokenAmount,
  decimalsFor,
  sumMinor,
} from "@/lib/money";

describe("parseDecimalToMinor", () => {
  it("parses plain US decimals exactly", () => {
    expect(parseDecimalToMinor("12.34", "USD")).toBe(1234n);
    expect(parseDecimalToMinor("0.01", "USD")).toBe(1n);
    expect(parseDecimalToMinor("1000000.00", "USD")).toBe(100000000n);
  });

  it("handles negative amounts and accounting parentheses", () => {
    expect(parseDecimalToMinor("-12.34", "USD")).toBe(-1234n);
    expect(parseDecimalToMinor("(12.34)", "USD")).toBe(-1234n);
    // "$ (1,234.56)" is an accounting-negative with the symbol separated by a
    // space; "-$1,234.56" is the symbol-after-minus form. Both are negatives.
    expect(parseDecimalToMinor("$ (1,234.56)", "USD")).toBe(-123456n);
    expect(parseDecimalToMinor("-$1,234.56", "USD")).toBe(-123456n);
  });

  it("strips a leading + sign used by payroll credits", () => {
    expect(parseDecimalToMinor("+4200.00", "USD")).toBe(420000n);
  });

  it("parses US thousands separators", () => {
    expect(parseDecimalToMinor("1,234.56", "USD")).toBe(123456n);
    expect(parseDecimalToMinor("1,234,567.89", "USD")).toBe(123456789n);
  });

  it("parses EU decimal-comma format", () => {
    expect(parseDecimalToMinor("1.234,56", "USD")).toBe(123456n);
    expect(parseDecimalToMinor("12,34", "USD", "eu")).toBe(1234n);
  });

  it("uses the correct scale for zero-decimal currencies", () => {
    expect(decimalsFor("JPY")).toBe(0);
    expect(parseDecimalToMinor("1234", "JPY")).toBe(1234n);
    expect(parseDecimalToMinor("1234.56", "JPY")).toBe(1234n); // truncated, not rounded
  });

  it("truncates (never rounds) excess precision to preserve exact input", () => {
    expect(parseDecimalToMinor("1.999", "USD")).toBe(199n);
  });

  it("rejects ambiguous or non-numeric input instead of guessing", () => {
    expect(parseDecimalToMinor("", "USD")).toBeNull();
    expect(parseDecimalToMinor("   ", "USD")).toBeNull();
    expect(parseDecimalToMinor("abc", "USD")).toBeNull();
    // A multi-dot value with groups of 3 is a thousands separator; anything
    // else (e.g. "12.3.4") is ambiguous and must be rejected, not guessed.
    expect(parseDecimalToMinor("1.234.567", "USD")).toBe(123456700n);
    expect(parseDecimalToMinor("12.3.4", "USD")).toBeNull();
    expect(parseDecimalToMinor(null, "USD")).toBeNull();
    expect(parseDecimalToMinor(undefined, "USD")).toBeNull();
  });

  it("never loses precision on large amounts (beyond IEEE-754 safe range)", () => {
    // 9,007,199,254,740,993.00 — deliberately past Number.MAX_SAFE_INTEGER
    expect(parseDecimalToMinor("9007199254740993.00", "USD")).toBe(900719925474099300n);
  });
});

describe("formatMinor", () => {
  it("formats minor units with symbol and grouping", () => {
    expect(formatMinor(123456n, "USD")).toBe("$1,234.56");
    expect(formatMinor(-1234n, "USD")).toBe("-$12.34");
  });

  it("formats zero-decimal currencies without a decimal part", () => {
    expect(formatMinor(1234n, "JPY")).toBe("¥1,234");
  });

  it("supports a signed display for cash-flow deltas", () => {
    expect(formatMinor(500n, "USD", { signed: true })).toBe("+$5.00");
  });

  it("formats token base units exactly, trimming trailing fraction zeros", () => {
    expect(formatTokenAmount("1234500000", 9)).toBe("1.2345");
    expect(formatTokenAmount("1000000000", 9)).toBe("1");
    expect(formatTokenAmount("0", 6)).toBe("0");
  });
});

describe("sumMinor", () => {
  it("sums BigInt values exactly", () => {
    expect(sumMinor([1n, 2n, 3n])).toBe(6n);
    expect(sumMinor([])).toBe(0n);
  });
});