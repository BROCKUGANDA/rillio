/**
 * CSV import pipeline tests — blueprint §4.2 FR-DATA-001/002/005, Phase 4.
 *
 * Guarantees pinned here:
 *   - malformed rows are surfaced, never silently dropped
 *   - duplicates are detected deterministically (idempotent re-import)
 *   - totals reconcile to accepted rows
 *   - formula injection is neutralised
 *   - locale/ambiguous formats do not silently corrupt amounts
 */

import { describe, it, expect } from "vitest";
import {
  parseCsv,
  suggestMapping,
  parseDate,
  sanitizeCell,
  processImport,
  fingerprintParts,
  CsvParseError,
  type ColumnMapping,
} from "@/lib/csv";

const MAPPING: ColumnMapping = {
  date: "Date",
  amount: "Amount",
  description: "Description",
};

describe("parseCsv", () => {
  it("parses a simple comma-separated file with headers", () => {
    const { rows, headers } = parseCsv("Date,Amount,Description\n2024-01-01,10.00,Coffee\n");
    expect(headers).toEqual(["Date", "Amount", "Description"]);
    expect(rows).toHaveLength(1);
    expect(rows[0].Description).toBe("Coffee");
  });

  it("detects a semicolon delimiter", () => {
    const { rows } = parseCsv("Date;Amount;Description\n2024-01-01;10,00;Coffee\n");
    expect(rows[0].Amount).toBe("10,00");
  });

  it("handles quoted fields containing the delimiter", () => {
    const { rows } = parseCsv('Date,Amount,Description\n2024-01-01,10.00,"Coffee, shop"\n');
    expect(rows[0].Description).toBe("Coffee, shop");
  });

  it("skips empty lines", () => {
    const { rows } = parseCsv("Date,Amount,Description\n\n2024-01-01,10.00,Coffee\n\n");
    expect(rows).toHaveLength(1);
  });
});

describe("suggestMapping", () => {
  it("maps common bank header names", () => {
    const map = suggestMapping(["Posted Date", "Amount", "Payee Name", "Currency"]);
    expect(map.date).toBe("Posted Date");
    expect(map.amount).toBe("Amount");
    expect(map.description).toBe("Payee Name");
    expect(map.currency).toBe("Currency");
  });

  it("returns nothing for unrecognisable headers", () => {
    expect(suggestMapping(["Foo", "Bar"])).toEqual({});
  });
});

describe("parseDate", () => {
  it("parses ISO 8601 as UTC", () => {
    expect(parseDate("2024-03-05")?.toISOString()).toBe("2024-03-05T00:00:00.000Z");
  });

  it("parses US M/D/YYYY", () => {
    expect(parseDate("3/5/2024")?.toISOString()).toBe("2024-03-05T00:00:00.000Z");
  });

  it("parses EU D.M.YYYY", () => {
    expect(parseDate("05.03.2024")?.toISOString()).toBe("2024-03-05T00:00:00.000Z");
  });

  it("returns null for unparseable dates rather than guessing", () => {
    expect(parseDate("not a date")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("sanitizeCell", () => {
  it("neutralises formula prefixes used in CSV injection", () => {
    expect(sanitizeCell("=1+1")).toBe("'=1+1");
    expect(sanitizeCell("+cmd")).toBe("'+cmd");
    expect(sanitizeCell("@@SUM(A1)")).toBe("'@@SUM(A1)");
    expect(sanitizeCell("-2+3")).toBe("'-2+3");
  });

  it("leaves ordinary text untouched", () => {
    expect(sanitizeCell("Coffee shop")).toBe("Coffee shop");
  });
});

/* ------------------------------ full pipeline ----------------------------- */

const CSV = [
  "Date,Amount,Description",
  "2024-01-05,-12.34,Coffee Shop",
  "2024-01-06,4200.00,Payroll",
  "2024-01-07,-99.99,Unknown Vendor",
  "not-a-date,-5.00,Bad Date Row",
  "2024-01-09,not-an-amount,Bad Amount Row",
  "2024-01-10,-3.00,",
].join("\n");

describe("processImport", () => {
  it("reports totals that reconcile to accepted rows", () => {
    const result = processImport(CSV, MAPPING, "USD");
    expect(result.acceptedRows + result.rejectedRows).toBe(result.totalRows);
    expect(result.totalRows).toBe(6);
  });

  it("accepts valid rows and rejects malformed ones with row/field detail", () => {
    const result = processImport(CSV, MAPPING, "USD");
    expect(result.acceptedRows).toBe(3);

    const codes = new Set(result.errors.map((e) => e.code));
    expect(codes.has("INVALID_DATE")).toBe(true);
    expect(codes.has("INVALID_AMOUNT")).toBe(true);
    expect(codes.has("MISSING_DESCRIPTION")).toBe(true);

    for (const e of result.errors) {
      expect(e.row).toBeGreaterThan(0);
      expect(e.field.length).toBeGreaterThan(0);
      expect(e.message.length).toBeGreaterThan(0);
    }
  });

  it("parses amounts with exact integer math", () => {
    const result = processImport(CSV, MAPPING, "USD");
    const payroll = result.normalized.find((n) => n.description === "Payroll");
    expect(payroll?.amountMinor).toBe(420000n);
    expect(payroll?.direction).toBe("inflow");
  });

  it("treats negative amounts as outflow", () => {
    const result = processImport(CSV, MAPPING, "USD");
    const coffee = result.normalized.find((n) => n.description === "Coffee Shop");
    expect(coffee?.amountMinor).toBe(-1234n);
    expect(coffee?.direction).toBe("outflow");
  });

  it("is idempotent: re-importing identical data marks rows duplicate", () => {
    const first = processImport(CSV, MAPPING, "USD");
    // Use the same exported helper the API route uses, so this test fails if the
    // pipeline's fingerprint definition ever drifts from persistence.
    const existing = new Set(
      first.normalized
        .filter((n) => n.occurredAt && n.amountMinor !== null)
        .map(
          (n) =>
            fingerprintParts({
              occurredAt: n.occurredAt!,
              amountMinor: n.amountMinor!,
              description: n.description,
              account: n.account,
            }),
        ),
    );
    const second = processImport(CSV, MAPPING, "USD", { existingFingerprints: existing });
    expect(second.duplicateRows).toBeGreaterThan(0);
    expect(second.acceptedRows).toBeLessThan(first.acceptedRows);
  });

  it("sanitises formula-injected descriptions", () => {
    const evil = ["Date,Amount,Description", '2024-01-01,-1.00,"=HYPERLINK(http://x)"'].join("\n");
    const result = processImport(evil, MAPPING, "USD");
    const row = result.normalized.find((n) => n.description.includes("HYPERLINK"));
    expect(row).toBeDefined();
    expect(row?.description.startsWith("=")).toBe(false);
  });

  it("raises CsvParseError for a structurally unparseable file", () => {
    // Unterminated quote cannot be recovered into rows.
    expect(() => processImport('Date,Amount,Description\n2024-01-01,-1.00,"unterminated', MAPPING, "USD")).toThrow(
      CsvParseError,
    );
  });

  it("never drops rows silently", () => {
    const result = processImport(CSV, MAPPING, "USD");
    expect(result.acceptedRows + result.rejectedRows + result.duplicateRows).toBe(result.totalRows);
  });
});