import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import {
  processImport,
  suggestMapping,
  type ColumnMapping,
} from "@/lib/csv";
import { categorize } from "@/lib/categorize";
import { createHash } from "crypto";
import { recordAudit } from "@/lib/audit";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

/** POST /api/imports — multipart upload with file + mapping, processes inline (MVP). */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(makeError("VALIDATION_ERROR", "Invalid request", "Expected multipart form data.", 400), { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      makeError("VALIDATION_ERROR", "Missing file", "Upload a CSV file.", 422, {
        fieldErrors: [{ field: "file", code: "REQUIRED", message: "Choose a CSV file." }],
      }),
      { status: 422 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      makeError("FILE_TOO_LARGE", "File too large", `Files must be under ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB.`, 422),
      { status: 422 }
    );
  }
  const mime = file.type || "text/csv";
  if (!/^(text\/csv|text\/plain|application\/vnd\.ms-excel|application\/csv)$/i.test(mime) && !file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json(
      makeError("UNSUPPORTED_FILE_TYPE", "Unsupported file type", "Upload a .csv file.", 422),
      { status: 422 }
    );
  }

  // Optional client-provided mapping (JSON); if absent, suggest from headers
  let mappingJson = formData.get("mapping") as string | null;
  const content = await file.text();

  // If mapping not provided, suggest and return for user confirmation
  let mapping: ColumnMapping | null = null;
  if (mappingJson) {
    try {
      mapping = JSON.parse(mappingJson) as ColumnMapping;
    } catch {
      return NextResponse.json(makeError("VALIDATION_ERROR", "Invalid mapping", "Mapping is not valid JSON.", 422), { status: 422 });
    }
  } else {
    // Parse headers and suggest
    const { headers } = suggestMappingFromContent(content);
    const suggestion = suggestMapping(headers);
    if (!suggestion.date || !suggestion.amount || !suggestion.description) {
      // Return the suggestion + headers for user to confirm mapping
      return NextResponse.json({
        status: "needs_mapping",
        headers,
        suggestion,
      });
    }
    mapping = suggestion as ColumnMapping;
  }

  if (!mapping || !mapping.date || !mapping.amount || !mapping.description) {
    return NextResponse.json(
      makeError("DATA_IMPORT_INVALID_COLUMN_MAPPING", "Column mapping required", "Map a date column and an amount column before continuing.", 422, {
        fieldErrors: [
          { field: "mapping.date", code: "REQUIRED", message: "Choose a date column." },
          { field: "mapping.amount", code: "REQUIRED", message: "Choose an amount column." },
          { field: "mapping.description", code: "REQUIRED", message: "Choose a description column." },
        ],
      }),
      { status: 422 }
    );
  }

  // Fetch existing fingerprints for dedupe (FR-DATA-001)
  const existingTxns = await db.transaction.findMany({
    where: { userId: user.id },
    select: { fingerprint: true },
  });
  const existingFingerprints = new Set(existingTxns.map((t) => t.fingerprint));

  const result = processImport(content, mapping, user.baseCurrency, {
    existingFingerprints,
    maxRows: 100000,
  });

  // Fetch user's categories and rules
  const [categories, rules] = await Promise.all([
    db.category.findMany({ where: { userId: user.id } }),
    db.categorizationRule.findMany({ where: { userId: user.id, enabled: true } }),
  ]);
  const categoryNameToId = new Map(categories.map((c) => [c.name, c.id]));

  // Create import job
  const importJob = await db.importJob.create({
    data: {
      userId: user.id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: mime,
      status: "normalizing",
      totalRows: result.totalRows,
      acceptedRows: result.acceptedRows,
      rejectedRows: result.rejectedRows,
      duplicateRows: result.duplicateRows,
      errorReportJson: JSON.stringify(result.errors.slice(0, 500)),
      idempotencyKey: createHash("sha256").update(content + mapping.date + mapping.amount).digest("hex").slice(0, 32),
    },
  });

  // Persist raw + normalized rows in a transaction
  const acceptedRows = result.normalized.filter((n) => n.errors.length === 0 && n.occurredAt && n.amountMinor !== null);
  await db.$transaction(
    acceptedRows.map((n) => {
      const fp = createHash("sha256")
        .update(`${n.occurredAt!.toISOString().slice(0, 10)}|${n.amountMinor!.toString()}|${(n.description || "").toLowerCase().slice(0, 120)}|${n.account.toLowerCase()}`)
        .digest("hex");
      // Categorize
      const cat = categorize(n.description, n.merchant, {
        rules: rules.map((r) => ({
          id: r.id,
          field: r.field as "merchant" | "description",
          pattern: r.pattern,
          categoryId: r.categoryId,
          priority: r.priority,
          enabled: r.enabled,
        })),
        merchants: [],
      });
      let categoryId: string | null = null;
      if (cat.categoryId) {
        if (cat.categoryId.startsWith("heuristic:")) {
          const name = cat.categoryId.slice("heuristic:".length);
          categoryId = categoryNameToId.get(name) ?? categoryNameToId.get("Uncategorized") ?? null;
        } else {
          categoryId = cat.categoryId;
        }
      }
      if (!categoryId) {
        categoryId = categoryNameToId.get("Uncategorized") ?? null;
      }

      return db.rawTransaction.create({
        data: {
          userId: user.id,
          importJobId: importJob.id,
          sourceRowNumber: n.rowIndex,
          rawPayload: JSON.stringify({ date: n.occurredAt, amount: n.amountMinor?.toString(), description: n.description, merchant: n.merchant, currency: n.currency }),
          sourceHash: fp,
        },
      });
    }),
    { timeout: 30000 }
  );

  // Now create normalized transactions linked to raw records
  const rawRecords = await db.rawTransaction.findMany({
    where: { importJobId: importJob.id },
  });
  const rawByRow = new Map(rawRecords.map((r) => [r.sourceRowNumber, r]));

  await db.$transaction(
    acceptedRows.map((n) => {
      const fp = createHash("sha256")
        .update(`${n.occurredAt!.toISOString().slice(0, 10)}|${n.amountMinor!.toString()}|${(n.description || "").toLowerCase().slice(0, 120)}|${n.account.toLowerCase()}`)
        .digest("hex");
      const cat = categorize(n.description, n.merchant, {
        rules: rules.map((r) => ({
          id: r.id,
          field: r.field as "merchant" | "description",
          pattern: r.pattern,
          categoryId: r.categoryId,
          priority: r.priority,
          enabled: r.enabled,
        })),
        merchants: [],
      });
      let categoryId: string | null = null;
      if (cat.categoryId) {
        if (cat.categoryId.startsWith("heuristic:")) {
          const name = cat.categoryId.slice("heuristic:".length);
          categoryId = categoryNameToId.get(name) ?? categoryNameToId.get("Uncategorized") ?? null;
        } else {
          categoryId = cat.categoryId;
        }
      }
      if (!categoryId) {
        categoryId = categoryNameToId.get("Uncategorized") ?? null;
      }
      const raw = rawByRow.get(n.rowIndex);
      return db.transaction.create({
        data: {
          userId: user.id,
          importJobId: importJob.id,
          rawTransactionId: raw?.id ?? null,
          occurredAt: n.occurredAt!,
          accountLabel: n.account,
          merchantName: n.merchant,
          description: n.description,
          amountMinor: n.amountMinor!,
          currency: n.currency,
          direction: n.direction!,
          status: "posted",
          categoryId: categoryId,
          sourceProvider: "csv",
          fingerprint: fp,
        },
      });
    }),
    { timeout: 30000 }
  );

  // Update import job status
  const finalStatus = result.acceptedRows === 0 ? "failed" : result.rejectedRows > 0 ? "partial" : "ready";
  await db.importJob.update({
    where: { id: importJob.id },
    data: {
      status: finalStatus,
      completedAt: new Date(),
    },
  });

  // Create notification
  await db.notification.create({
    data: {
      userId: user.id,
      type: "import_complete",
      title: result.rejectedRows > 0 ? "Import completed with review items" : "Import completed",
      body: `${result.acceptedRows} of ${result.totalRows} rows imported. ${result.rejectedRows} need review.`,
      payload: JSON.stringify({ importJobId: importJob.id }),
    },
  });

  await recordAudit({
    userId: user.id,
    actor: "user",
    action: "import.completed",
    resourceType: "ImportJob",
    resourceId: importJob.id,
    metadata: {
      fileName: importJob.fileName,
      finalStatus,
      totalRows: result.totalRows,
      acceptedRows: result.acceptedRows,
      rejectedRows: result.rejectedRows,
      duplicateRows: result.duplicateRows,
    },
  });

  return NextResponse.json({
    importJobId: importJob.id,
    status: finalStatus,
    totalRows: result.totalRows,
    acceptedRows: result.acceptedRows,
    rejectedRows: result.rejectedRows,
    duplicateRows: result.duplicateRows,
    errors: result.errors.slice(0, 100),
  });
}

function suggestMappingFromContent(content: string): { headers: string[] } {
  // Parse first non-empty line as headers
  const firstLine = content.replace(/\r\n/g, "\n").split("\n").find((l) => l.trim().length > 0) ?? "";
  const candidates = [",", ";", "\t", "|"];
  let delimiter = ",";
  let bestScore = -1;
  for (const d of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const c = firstLine[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (c === d && !inQuotes) count++;
    }
    if (count > bestScore) {
      bestScore = count;
      delimiter = d;
    }
  }
  const headers = firstLine.split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ""));
  return { headers };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const imports = await db.importJob.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ imports });
}
