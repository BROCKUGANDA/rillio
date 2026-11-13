import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { getProvider, decryptCredential } from "@/lib/providers/registry";
import { categorize } from "@/lib/categorize";
import { createHash } from "crypto";
import { parseDecimalToMinor } from "@/lib/money";

/**
 * POST /api/connections/[id]/sync
 *
 * Pull transactions from the provider and persist through the existing
 * ingestion pipeline (raw → normalized → categorized → deduped).
 *
 * Per blueprint §4.2: idempotent on retry, no silent row loss, rejected rows surfaced.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const { id } = await params;
  const connection = await db.financialConnection.findFirst({
    where: { id, userId: user.id },
    include: { credential: true },
  });
  if (!connection) {
    return NextResponse.json(makeError("NOT_FOUND", "Connection not found", "This connection does not exist.", 404), { status: 404 });
  }
  if (connection.revokedAt) {
    return NextResponse.json(makeError("CONNECTION_REVOKED", "Connection revoked", "This connection has been revoked.", 409), { status: 409 });
  }
  if (!connection.credential) {
    return NextResponse.json(makeError("CREDENTIAL_MISSING", "Credential missing", "No stored credential for this connection.", 409), { status: 409 });
  }

  const provider = getProvider(connection.provider);
  if (!provider) {
    return NextResponse.json(makeError("PROVIDER_NOT_FOUND", "Unknown provider", "Provider is no longer registered.", 409), { status: 409 });
  }

  // Mark syncing
  await db.financialConnection.update({
    where: { id: connection.id },
    data: { status: "syncing" },
  });

  try {
    // Decrypt credential
    const plaintext = decryptCredential({
      ciphertext: connection.credential.ciphertext,
      iv: connection.credential.iv,
      algorithm: connection.credential.algorithm,
    });
    const credentialRef = {
      ciphertext: connection.credential.ciphertext,
      iv: connection.credential.iv,
      algorithm: connection.credential.algorithm,
      plaintext,
    };

    // Determine sync window (default: last 90 days)
    const body = await req.json().catch(() => ({}));
    const days = (body.days as number) || 90;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // List accounts
    const accounts = await provider.listAccounts(credentialRef);
    await db.financialConnection.update({
      where: { id: connection.id },
      data: {
        accountsJson: JSON.stringify(accounts),
      },
    });

    // Fetch transactions for each account
    const allTxns: Array<{ txn: Awaited<ReturnType<typeof provider.fetchTransactions>>[number]; accountExternalId: string }> = [];
    for (const acc of accounts) {
      const txns = await provider.fetchTransactions(credentialRef, acc.id, startDate, endDate);
      for (const t of txns) {
        allTxns.push({ txn: t, accountExternalId: acc.id });
      }
    }

    // Get user's categories + rules
    const [categories, rules, existingFingerprints] = await Promise.all([
      db.category.findMany({ where: { userId: user.id } }),
      db.categorizationRule.findMany({ where: { userId: user.id, enabled: true } }),
      db.transaction.findMany({
        where: { userId: user.id, sourceProvider: connection.provider },
        select: { fingerprint: true },
      }),
    ]);
    const seenFingerprints = new Set(existingFingerprints.map((t) => t.fingerprint));
    const categoryNameToId = new Map(categories.map((c) => [c.name, c.id]));

    // Create an import job to track this sync
    const importJob = await db.importJob.create({
      data: {
        userId: user.id,
        fileName: `${connection.provider}-sync-${new Date().toISOString().slice(0, 10)}.csv`,
        fileSize: 0,
        mimeType: "application/json",
        status: "normalizing",
        totalRows: allTxns.length,
        idempotencyKey: createHash("sha256")
          .update(`${connection.id}|${startDate.toISOString()}|${endDate.toISOString()}`)
          .digest("hex")
          .slice(0, 32),
      },
    });

    let accepted = 0;
    let duplicate = 0;
    let rejected = 0;
    const errors: { row: number; field: string; code: string; message: string }[] = [];

    // Persist raw + normalized for each transaction
    for (let i = 0; i < allTxns.length; i++) {
      const { txn, accountExternalId } = allTxns[i];
      const amountMinor = parseDecimalToMinor(txn.amount, txn.currency);
      if (!amountMinor) {
        rejected++;
        errors.push({ row: i + 1, field: "amount", code: "INVALID_AMOUNT", message: `Could not parse "${txn.amount}"` });
        continue;
      }
      const occurredAt = new Date(txn.occurredAt);
      if (isNaN(occurredAt.getTime())) {
        rejected++;
        errors.push({ row: i + 1, field: "date", code: "INVALID_DATE", message: `Could not parse "${txn.occurredAt}"` });
        continue;
      }
      const description = (txn.description || "").trim();
      if (!description) {
        rejected++;
        errors.push({ row: i + 1, field: "description", code: "MISSING_DESCRIPTION", message: "Empty description" });
        continue;
      }
      const fp = createHash("sha256")
        .update(`${occurredAt.toISOString().slice(0, 10)}|${amountMinor.toString()}|${description.toLowerCase().slice(0, 120)}|${accountExternalId.toLowerCase()}`)
        .digest("hex");
      if (seenFingerprints.has(fp)) {
        duplicate++;
        continue;
      }
      seenFingerprints.add(fp);

      // Categorize
      const cat = categorize(description, txn.merchantName ?? null, {
        rules: rules.map((r) => ({
          id: r.id,
          field: r.field as "merchant" | "description",
          pattern: r.pattern,
          categoryId: r.categoryId,
          priority: r.priority,
          enabled: r.enabled,
        })),
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
      if (!categoryId) categoryId = categoryNameToId.get("Uncategorized") ?? null;

      const direction = amountMinor > 0n ? "inflow" : "outflow";

      // Raw evidence
      const raw = await db.rawTransaction.create({
        data: {
          userId: user.id,
          importJobId: importJob.id,
          sourceRowNumber: i + 1,
          rawPayload: JSON.stringify({ ...txn, accountExternalId, sourceProvider: connection.provider }),
          sourceHash: fp,
          externalId: txn.externalId,
        },
      });

      await db.transaction.create({
        data: {
          userId: user.id,
          importJobId: importJob.id,
          rawTransactionId: raw.id,
          occurredAt,
          accountLabel: accountExternalId,
          merchantName: txn.merchantName,
          description,
          amountMinor,
          currency: txn.currency,
          direction,
          status: txn.status,
          categoryId,
          sourceProvider: connection.provider,
          externalTransactionId: txn.externalId,
          fingerprint: fp,
        },
      });
      accepted++;
    }

    // Update import job
    await db.importJob.update({
      where: { id: importJob.id },
      data: {
        status: accepted === 0 ? "failed" : rejected > 0 ? "partial" : "ready",
        acceptedRows: accepted,
        rejectedRows: rejected,
        duplicateRows: duplicate,
        errorReportJson: JSON.stringify(errors.slice(0, 100)),
        completedAt: new Date(),
        fileSize: allTxns.length,
      },
    });

    // Update connection
    await db.financialConnection.update({
      where: { id: connection.id },
      data: {
        status: "active",
        lastSyncAt: new Date(),
        lastSyncStatus: rejected > 0 ? "partial" : "ok",
        lastSyncError: rejected > 0 ? `${rejected} rows rejected` : null,
        syncCount: { increment: 1 },
      },
    });

    // Notify
    await db.notification.create({
      data: {
        userId: user.id,
        type: "sync_complete",
        title: `${provider.info.name} sync complete`,
        body: `${accepted} new transactions imported. ${duplicate} duplicates skipped. ${rejected} rejected.`,
        payload: JSON.stringify({ connectionId: connection.id, importJobId: importJob.id }),
      },
    });

    return NextResponse.json({
      ok: true,
      connectionId: connection.id,
      importJobId: importJob.id,
      accounts: accounts.length,
      total: allTxns.length,
      accepted,
      duplicate,
      rejected,
      errors: errors.slice(0, 20),
      isDemo: provider.info.isDemo,
    });
  } catch (e) {
    await db.financialConnection.update({
      where: { id: connection.id },
      data: {
        status: "error",
        lastSyncAt: new Date(),
        lastSyncStatus: "failed",
        lastSyncError: e instanceof Error ? e.message : "Sync failed",
      },
    });
    return NextResponse.json(
      makeError("SYNC_FAILED", "Sync failed", e instanceof Error ? e.message : "Provider sync failed.", 500, { retryable: true }),
      { status: 500 }
    );
  }
}
