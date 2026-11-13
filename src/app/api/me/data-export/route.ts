import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";

/**
 * POST /api/me/data-export
 *
 * Queues a privacy export request. Returns the request record.
 * Per blueprint §4.9 FR-PRIV-002: protected export with documented retention.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  // Check for existing in-progress request
  const existing = await db.dataExportRequest.findFirst({
    where: { userId: user.id, status: { in: ["requested", "processing"] } },
  });
  if (existing) {
    return NextResponse.json({
      request: existing,
      message: "An export is already in progress. We'll notify you when it's ready.",
    });
  }
  const request = await db.dataExportRequest.create({
    data: { userId: user.id, status: "requested" },
  });
  await db.auditEvent.create({
    data: {
      userId: user.id,
      actor: user.id,
      action: "data_export_requested",
      resourceType: "data_export",
      resourceId: request.id,
    },
  });
  // For MVP, immediately mark as processing
  await db.dataExportRequest.update({
    where: { id: request.id },
    data: { status: "processing" },
  });
  // Build the export artifact synchronously (small MVP scale)
  const [txns, goals, wallets, imports, categories] = await Promise.all([
    db.transaction.findMany({ where: { userId: user.id }, include: { category: true } }),
    db.goal.findMany({ where: { userId: user.id } }),
    db.wallet.findMany({ where: { userId: user.id } }),
    db.importJob.findMany({ where: { userId: user.id } }),
    db.category.findMany({ where: { userId: user.id } }),
  ]);
  const exportData = {
    user: { id: user.id, email: user.email, displayName: user.displayName, baseCurrency: user.baseCurrency },
    exportedAt: new Date().toISOString(),
    transactions: txns.map((t) => ({
      id: t.id,
      occurredAt: t.occurredAt,
      description: t.description,
      merchantName: t.merchantName,
      amountMinor: t.amountMinor.toString(),
      currency: t.currency,
      direction: t.direction,
      status: t.status,
      category: t.category?.name ?? null,
      sourceProvider: t.sourceProvider,
    })),
    goals: goals.map((g) => ({
      ...g,
      targetMinor: g.targetMinor.toString(),
      startingAmountMinor: g.startingAmountMinor.toString(),
      plannedContributionMinor: g.plannedContributionMinor.toString(),
    })),
    wallets: wallets.map((w) => ({ id: w.id, address: w.address, verification: w.verification, createdAt: w.createdAt })),
    imports: imports.map((i) => ({
      ...i,
      // ImportJob has no BigInt fields, but spread safely
    })),
    categories,
  };
  const artifactUrl = "/api/me/data-export/" + request.id;
  await db.dataExportRequest.update({
    where: { id: request.id },
    data: {
      status: "ready",
      completedAt: new Date(),
      artifactUrl,
    },
  });
  await db.notification.create({
    data: {
      userId: user.id,
      type: "data_export_ready",
      title: "Your data export is ready",
      body: "You can download a copy of your Rillio data from Settings → Privacy.",
      payload: JSON.stringify({ requestId: request.id }),
    },
  });
  const final = await db.dataExportRequest.findUnique({ where: { id: request.id } });
  return NextResponse.json({
    request: final,
    export: exportData,
  });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const requests = await db.dataExportRequest.findMany({
    where: { userId: user.id },
    orderBy: { requestedAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ requests });
}
