/**
 * Rillio money utilities.
 *
 * Per blueprint §4.2 FR-DATA-004 and §11.2: no float arithmetic for money.
 * All money is stored and processed as integer minor units (BigInt).
 * Currency codes follow ISO 4217.
 */

export type Minor = bigint;

export const ZERO: Minor = 0n;

/** ISO 4217 currency decimals for currencies Rillio supports in MVP. */
export const CURRENCY_DECIMALS: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  KES: 2,
  NGN: 2,
  ZAR: 2,
  UGX: 0,
  RWF: 0,
  JPY: 0,
  AUD: 2,
  CAD: 2,
  CHF: 2,
  CNY: 2,
  INR: 2,
};

export function decimalsFor(currency: string): number {
  return CURRENCY_DECIMALS[currency] ?? 2;
}

/**
 * Parse a decimal numeric string into minor units using exact integer math.
 * Accepts "12.34", "-12.34", "1,234.56" (US), "1.234,56" (EU).
 * Returns null if the input cannot be parsed unambiguously.
 */
export function parseDecimalToMinor(
  raw: string | number | null | undefined,
  currency: string,
  localeHint?: "us" | "eu"
): Minor | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s) return null;

  const decimals = decimalsFor(currency);

  // Detect an accounting-negative before stripping decoration: "(1,234.56)",
  // "$ (1,234.56)", "-1,234.56" and "-$1,234.56" all mean a negative amount.
  const isNegative =
    /^\(.*\)$/.test(s) || // (1,234.56)
    /^\s*-/.test(s) || // -1,234.56 | -$1,234.56
    /^[^\d(]*\(/.test(s); // $ (1,234.56) — symbol then a parenthesised amount

  // Strip currency symbols, spaces (incl. non-breaking), parentheses, minus AND
  // plus signs — many bank exports prefix positive amounts with "+"
  // (e.g. "+4200.00" for payroll credits).
  s = s.replace(/[$€£¥₹₦₩]/g, "");
  s = s.replace(/[()]/g, "");
  s = s.replace(/^[+-]/, "");
  s = s.replace(/[\s\u00A0\u202F']/g, "");

  // Detect both thousand and decimal separators
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  let intPart = "";
  let fracPart = "";

  if (hasComma && hasDot) {
    // Whichever appears last is the decimal separator
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // EU: 1.234,56 → strip dots (thousands), comma becomes decimal
      const normalized = s.replace(/\./g, "").replace(/,/g, ".");
      const idx = normalized.lastIndexOf(".");
      intPart = normalized.slice(0, idx);
      fracPart = normalized.slice(idx + 1);
    } else {
      // US: 1,234.56 → strip commas (thousands), dot stays decimal
      const normalized = s.replace(/,/g, "");
      const idx = normalized.lastIndexOf(".");
      intPart = normalized.slice(0, idx);
      fracPart = normalized.slice(idx + 1);
    }
  } else if (hasComma) {
    // Comma only — could be EU decimal (12,34) or US thousands (1,234)
    // Use locale hint; default: if single comma and 1-2 digits after, treat as decimal
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2 && localeHint !== "us") {
      intPart = parts[0];
      fracPart = parts[1];
    } else {
      intPart = s.replace(/,/g, "");
    }
  } else if (hasDot) {
    const parts = s.split(".");
    if (parts.length === 2) {
      intPart = parts[0];
      fracPart = parts[1];
    } else if (parts.length > 2) {
      // Multiple dots — only valid as thousands separators when every group
      // after the first is exactly 3 digits ("1.234.567"). Anything else
      // ("12.3.4") is ambiguous and rejected rather than guessed.
      const groups = parts.slice(1);
      const allGroupsAreTriples = groups.every((g) => g.length === 3);
      if (!allGroupsAreTriples) return null;
      intPart = parts.join("");
    } else {
      intPart = s;
    }
  } else {
    intPart = s;
  }

  // Reject anything that is not a plain positive integer at this point.
  // An empty integer part is fine only when it is a bare decimal (".5"), which
  // we normalise to "0.5"; otherwise an unparseable value is rejected.
  if (intPart === "") {
    if (fracPart) intPart = "0";
    else return null;
  }
  if (!/^\d+$/.test(intPart)) return null;
  if (fracPart && !/^\d+$/.test(fracPart)) return null;

  // Pad/truncate fractional part to currency decimals
  if (fracPart) {
    if (fracPart.length > decimals) {
      // Truncate (do not round) — preserves exact input
      fracPart = fracPart.slice(0, decimals);
    } else {
      fracPart = fracPart.padEnd(decimals, "0");
    }
  } else {
    fracPart = "0".repeat(decimals);
  }

  // Compose integer string
  const combined = intPart + fracPart;
  // Validate
  if (!/^\d+$/.test(combined)) return null;

  let value = BigInt(combined);
  if (isNegative) value = -value;
  return value;
}

/** Format minor units to a display string with currency symbol and proper decimals. */
export function formatMinor(
  minor: Minor,
  currency: string,
  opts: { signed?: boolean; symbol?: boolean } = {}
): string {
  const decimals = decimalsFor(currency);
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const absStr = abs.toString().padStart(decimals + 1, "0");
  const intPart = absStr.slice(0, absStr.length - decimals) || "0";
  const fracPart = decimals > 0 ? absStr.slice(absStr.length - decimals) : "";

  const symbol = opts.symbol !== false ? currencySymbol(currency) : "";
  const intPartGrouped = Number(intPart).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
  const sign = negative ? "-" : opts.signed ? "+" : "";
  return `${sign}${symbol}${intPartGrouped}${
    decimals > 0 ? "." + fracPart : ""
  }`;
}

export function currencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    KES: "KSh ",
    NGN: "₦",
    ZAR: "R ",
    UGX: "USh ",
    RWF: "RF ",
    JPY: "¥",
    AUD: "A$",
    CAD: "C$",
    CHF: "CHF ",
    CNY: "¥",
    INR: "₹",
  };
  return symbols[currency] ?? currency + " ";
}

/** Signed minor used in cash-flow math. */
export function addMinor(a: Minor, b: Minor): Minor {
  return a + b;
}

export function sumMinor(values: Minor[]): Minor {
  return values.reduce((acc, v) => acc + v, 0n);
}

/** Token base-unit helpers — never round token amounts (blueprint §11.2). */
export function parseTokenBaseUnits(raw: string): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return null;
  return s;
}

export function formatTokenAmount(baseUnits: string, decimals: number): string {
  if (!baseUnits) return "0";
  const isNeg = baseUnits.startsWith("-");
  const abs = isNeg ? baseUnits.slice(1) : baseUnits;
  const padded = abs.padStart(decimals + 1, "0");
  const intPart = padded.slice(0, padded.length - decimals) || "0";
  const fracPart = decimals > 0 ? padded.slice(padded.length - decimals) : "";
  const trimmedFrac = fracPart.replace(/0+$/, "");
  return `${isNeg ? "-" : ""}${intPart}${
    trimmedFrac ? "." + trimmedFrac : ""
  }`;
}

/** Convert minor units to a JS number ONLY for charting (lossy — never persist or compute on this). */
export function minorToChartNumber(minor: Minor, currency: string): number {
  const decimals = decimalsFor(currency);
  const str = minor.toString();
  const neg = str.startsWith("-");
  const abs = neg ? str.slice(1) : str;
  const padded = abs.padStart(decimals + 1, "0");
  const intPart = padded.slice(0, padded.length - decimals);
  const fracPart = padded.slice(padded.length - decimals);
  const n = Number(`${intPart}.${fracPart}`);
  return neg ? -n : n;
}
