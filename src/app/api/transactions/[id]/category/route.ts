import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { categoryId, reason } = body as { categoryId?: string; reason?: string };

  if (!categoryId) {
    return NextResponse.json(
      makeError("VALIDATION_ERROR", "Missing category", "Choose a category.", 422, {
        fieldErrors: [{ field: "categoryId", code: "REQUIRED", message: "Choose a category." }],
      }),
      { status: 422 }
    );
  }

  // Verify ownership of transaction + category
  const [txn, category] = await Promise.all([
    db.transaction.findFirst({ where: { id, userId: user.id } }),
    db.category.findFirst({ where: { id: categoryId, userId: user.id } }),
  ]);
  if (!txn) {
    return NextResponse.json(makeError("NOT_FOUND", "Transaction not found", "This transaction does not exist.", 404), { status: 404 });
  }
  if (!category) {
    return NextResponse.json(makeError("NOT_FOUND", "Category not found", "This category does not exist.", 404), { status: 404 });
  }

  // Record history first (FR-CAT-001: versioned rationale)
  await db.transactionCategoryHistory.create({
    data: {
      transactionId: txn.id,
      categoryId,
      actor: "user",
      reason: reason ?? "User correction",
      modelVersion: "manual",
    },
  });

  const updated = await db.transaction.update({
    where: { id: txn.id },
    data: { categoryId, updatedAt: new Date() },
    include: { category: true },
  });

  await recordAudit({
    userId: user.id,
    actor: "user",
    action: "transaction.category_changed",
    resourceType: "Transaction",
    resourceId: txn.id,
    metadata: {
      fromCategoryId: txn.categoryId,
      toCategoryId: categoryId,
      reason: reason ?? "User correction",
    },
  });

  return NextResponse.json({
    transaction: {
      id: updated.id,
      categoryId: updated.categoryId,
      category: updated.category ? { id: updated.category.id, name: updated.category.name, kind: updated.category.kind } : null,
    },
  });
}
