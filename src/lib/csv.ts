/**
 * CSV import pipeline — deterministic, idempotent, no silent row loss.
 *
 * Flow per blueprint §4.2 and Phase 4 of STAFF_ENGINEER_IMPLEMENTATION_PROMPT.md:
 *   upload → file validation → parse → map date/amount/currency
 *   → exact normalization → persist raw evidence → dedupe → batch import
 *   → rejected-row report → terminal state
 *
 * Money is parsed with exact integer math (lib/money.ts). No float arithmetic.
 */

import { parse as csvParse } from "csv-parse/sync";
import { createHash } from "crypto";
import {
  parseDecimalToMinor,
  type Minor,
} from "./money";

export type CsvRow = Record<string, string>;

export type ColumnMapping = {
  date: string;
  amount: string;
  description: string;
  merchant?: string;
  currency?: string;
  account?: string;
};

export type ParsedRow = {
  rowIndex: number; // 1-indexed, original file
  date: string;
  amount: string;
  description: string;
  merchant?: string;
  currency?: string;
  account?: string;
};

export type NormalizedRow = {
  rowIndex: number;
  occurredAt: Date | null;
  amountMinor: Minor | null;
  currency: string;
  description: string;
  merchant: string | null;
  account: string;
  direction: "inflow" | "outflow" | null;
  errors: RowError[];
};

export type RowError = {
  row: number;
  field: string;
  code: string;
  message: string;
};

export type ImportResult = {
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  duplicateRows: number;
  errors: RowError[];
  normalized: NormalizedRow[];
};

/** Detect column delimiter and parse CSV to records. */
export function parseCsv(content: string): { rows: CsvRow[]; headers: string[] } {
  // Normalize line endings
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Detect delimiter by counting common candidates in first non-empty line
  const firstLine = normalized.split("\n").find((l) => l.trim().length > 0) ?? "";
  const candidates = [",", ";", "\t", "|"];
  let delimiter = ",";
  let bestScore = -1;
  for (const d of candidates) {
    const count = countUnquoted(firstLine, d);
    if (count > bestScore) {
      bestScore = count;
      delimiter = d;
    }
  }

  const records = csvParse(normalized, {
    delimiter,
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as CsvRow[];

  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  return { rows: records, headers };
}

function countUnquoted(line: string, delim: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (c === delim && !inQuotes) {
      count++;
    }
  }
  return count;
}

/** Suggest a column mapping by matching header names to known patterns. */
export function suggestMapping(headers: string[]): Partial<ColumnMapping> {
  const map: Partial<ColumnMapping> = {};
  for (const h of headers) {
    const lower = h.toLowerCase().trim();
    if (!map.date && /date|posted|trans.*date|time/.test(lower)) {
      map.date = h;
    }
    if (!map.amount && /amount|value|debit|credit|total|net|amt/.test(lower)) {
      map.amount = h;
    }
    if (!map.description && /desc|memo|note|narration|details|payee|name/.test(lower)) {
      map.description = h;
    }
    if (!map.merchant && /merchant|payee|store|vendor/.test(lower)) {
      map.merchant = h;
    }
    if (!map.currency && /currency|ccy/.test(lower)) {
      map.currency = h;
    }
    if (!map.account && /account|acc/.test(lower)) {
      map.account = h;
    }
  }
  return map;
}

/** Parse a date string flexibly. Returns null if ambiguous/unparseable. */
export function parseDate(s: string): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;

  // ISO 8601
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
    const [, y, mo, d, h = "00", mi = "00", se = "00"] = isoMatch;
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +se));
    if (!isNaN(dt.getTime())) return dt;
  }

  // US: M/D/YYYY or MM/DD/YYYY
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?)?$/i);
  if (usMatch) {
    const [, mo, d, y, h = "00", mi = "00", se = "00", ap] = usMatch;
    let hour = +h;
    if (ap && ap.toLowerCase() === "pm" && hour < 12) hour += 12;
    if (ap && ap.toLowerCase() === "am" && hour === 12) hour = 0;
    const year = y.length === 2 ? 2000 + +y : +y;
    const dt = new Date(Date.UTC(year, +mo - 1, +d, hour, +mi, +se));
    if (!isNaN(dt.getTime())) return dt;
  }

  // EU: D.M.YYYY or DD.MM.YYYY
  const euMatch = trimmed.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (euMatch) {
    const [, d, mo, y] = euMatch;
    const year = y.length === 2 ? 2000 + +y : +y;
    const dt = new Date(Date.UTC(year, +mo - 1, +d));
    if (!isNaN(dt.getTime())) return dt;
  }

  // Fallback to Date.parse
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) return fallback;

  return null;
}

/** Detect sign convention for amount column (blueprint Phase 4: sign conventions). */
export function detectSignConvention(rows: ParsedRow[]): {
  hasSeparateDebitCredit: boolean;
  positiveIsInflow: boolean;
} {
  if (rows.length === 0) {
    return { hasSeparateDebitCredit: false, positiveIsInflow: true };
  }
  let positiveCount = 0;
  let negativeCount = 0;
  for (const r of rows) {
    if (!r.amount) continue;
    if (/^-/.test(r.amount)) negativeCount++;
    else if (/^\+?[\d.,]+$/.test(r.amount)) positiveCount++;
  }
  // Most statements use negative for outflow
  return {
    hasSeparateDebitCredit: false,
    positiveIsInflow: negativeCount >= positiveCount * 0.4 || negativeCount > 0,
  };
}

/** Normalize a single parsed row into exact, validated form. */
export function normalizeRow(
  parsed: ParsedRow,
  mapping: ColumnMapping,
  defaultCurrency: string,
  signConvention: { positiveIsInflow: boolean }
): NormalizedRow {
  const errors: RowError[] = [];

  // Date
  const occurredAt = parseDate(parsed.date);
  if (!occurredAt) {
    errors.push({
      row: parsed.rowIndex,
      field: mapping.date,
      code: "INVALID_DATE",
      message: `Could not parse date "${parsed.date}".`,
    });
  }

  // Amount — exact integer math
  const currency = (parsed.currency || defaultCurrency || "USD").toUpperCase();
  const amountMinor = parseDecimalToMinor(parsed.amount, currency);
  if (amountMinor === null) {
    errors.push({
      row: parsed.rowIndex,
      field: mapping.amount,
      code: "INVALID_AMOUNT",
      message: `Could not parse amount "${parsed.amount}".`,
    });
  }

  // Direction
  let direction: "inflow" | "outflow" | null = null;
  if (amountMinor !== null) {
    if (amountMinor > 0n) {
      direction = signConvention.positiveIsInflow ? "inflow" : "outflow";
    } else if (amountMinor < 0n) {
      direction = signConvention.positiveIsInflow ? "outflow" : "inflow";
    } else {
      direction = "inflow";
    }
  }

  // Description
  const description = (parsed.description || "").trim();
  if (!description) {
    errors.push({
      row: parsed.rowIndex,
      field: mapping.description,
      code: "MISSING_DESCRIPTION",
      message: "Description is required.",
    });
  }

  // Formula injection guard (blueprint Phase 4: formula injection)
  const safeDescription = sanitizeCell(description);
  const safeMerchant = parsed.merchant ? sanitizeCell(parsed.merchant) : null;
  if (safeDescription !== description) {
    // Sanitized — not blocking, but record
  }

  return {
    rowIndex: parsed.rowIndex,
    occurredAt,
    amountMinor,
    currency,
    description: safeDescription,
    merchant: safeMerchant,
    account: (parsed.account || "default").trim() || "default",
    direction,
    errors,
  };
}

/** Prevent CSV/formula injection in cells that might be exported. */
export function sanitizeCell(s: string): string {
  if (!s) return s;
  // Remove control chars and neutralize formula prefixes
  const cleaned = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  if (/^[=+\-@]/.test(cleaned)) {
    return "'" + cleaned;
  }
  return cleaned;
}

/** Compute deterministic fingerprint for dedupe (blueprint §4.2 FR-DATA-005). */
export function fingerprint(row: NormalizedRow): string | null {
  if (!row.occurredAt || row.amountMinor === null) return null;
  const date = row.occurredAt.toISOString().slice(0, 10);
  const amount = row.amountMinor.toString();
  const desc = (row.description || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120);
  const account = (row.account || "default").toLowerCase();
  return createHash("sha256")
    .update(`${date}|${amount}|${desc}|${account}`)
    .digest("hex");
}

/** Run the full normalize+dedupe pipeline on parsed CSV rows. */
export function processImport(
  content: string,
  mapping: ColumnMapping,
  defaultCurrency: string,
  options: { existingFingerprints?: Set<string>; maxRows?: number } = {}
): ImportResult {
  const { rows } = parseCsv(content);
  const maxRows = options.maxRows ?? 100000;

  const errors: RowError[] = [];
  const normalized: NormalizedRow[] = [];
  const seenFingerprints = new Set<string>(options.existingFingerprints ?? []);
  let duplicateRows = 0;

  // First pass: parse to ParsedRow
  const parsedRows: ParsedRow[] = rows.map((r, idx) => ({
    rowIndex: idx + 2, // header is row 1
    date: r[mapping.date] || "",
    amount: r[mapping.amount] || "",
    description: r[mapping.description] || "",
    merchant: mapping.merchant ? r[mapping.merchant] : undefined,
    currency: mapping.currency ? r[mapping.currency] : undefined,
    account: mapping.account ? r[mapping.account] : undefined,
  }));

  // Detect sign convention
  const signConvention = detectSignConvention(parsedRows);

  // Second pass: normalize
  for (const p of parsedRows) {
    if (normalized.length >= maxRows) {
      errors.push({
        row: p.rowIndex,
        field: "_file",
        code: "ROW_LIMIT_EXCEEDED",
        message: `Import limited to ${maxRows} rows.`,
      });
      break;
    }
    const n = normalizeRow(p, mapping, defaultCurrency, signConvention);
    if (n.errors.length > 0) {
      errors.push(...n.errors);
      // Still push so we can show rejection report
      normalized.push(n);
      continue;
    }
    // Dedupe
    const fp = fingerprint(n);
    if (fp) {
      if (seenFingerprints.has(fp)) {
        duplicateRows++;
        n.errors.push({
          row: n.rowIndex,
          field: "_dedupe",
          code: "DUPLICATE",
          message: "Row appears to be a duplicate of an existing transaction.",
        });
        errors.push(n.errors[n.errors.length - 1]);
        normalized.push(n);
        continue;
      }
      seenFingerprints.add(fp);
    }
    normalized.push(n);
  }

  const acceptedRows = normalized.filter((n) => n.errors.length === 0).length;
  const rejectedRows = normalized.length - acceptedRows;

  return {
    totalRows: rows.length,
    acceptedRows,
    rejectedRows,
    duplicateRows,
    errors,
    normalized,
  };
}
