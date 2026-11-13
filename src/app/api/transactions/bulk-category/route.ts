import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { transactionIds, categoryId, reason } = body as {
    transactionIds?: string[];
    categoryId?: string;
    reason?: string;
  };

  if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
    return NextResponse.json(
      makeError("VALIDATION_ERROR", "Missing transactions", "Select at least one transaction.", 422, {
        fieldErrors: [{ field: "transactionIds", code: "REQUIRED", message: "Select at least one transaction." }],
      }),
      { status: 422 }
    );
  }
  if (!categoryId) {
    return NextResponse.json(
      makeError("VALIDATION_ERROR", "Missing category", "Choose a category.", 422, {
        fieldErrors: [{ field: "categoryId", code: "REQUIRED", message: "Choose a category." }],
      }),
      { status: 422 }
    );
  }
  if (transactionIds.length > 1000) {
    return NextResponse.json(makeError("VALIDATION_ERROR", "Too many", "Bulk edit limited to 1000 transactions.", 422), { status: 422 });
  }

  const category = await db.category.findFirst({ where: { id: categoryId, userId: user.id } });
  if (!category) {
    return NextResponse.json(makeError("NOT_FOUND", "Category not found", "This category does not exist.", 404), { status: 404 });
  }

  // Verify ownership
  const txns = await db.transaction.findMany({
    where: { id: { in: transactionIds }, userId: user.id },
    select: { id: true },
  });
  const validIds = txns.map((t) => t.id);

  await db.$transaction([
    ...validIds.map((id) =>
      db.transactionCategoryHistory.create({
        data: {
          transactionId: id,
          categoryId,
          actor: "user",
          reason: reason ?? "Bulk user correction",
          modelVersion: "manual-bulk",
        },
      })
    ),
    db.transaction.updateMany({
      where: { id: { in: validIds }, userId: user.id },
      data: { categoryId, updatedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ updated: validIds.length });
}
