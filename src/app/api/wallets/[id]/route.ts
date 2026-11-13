import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const { id } = await params;
  const wallet = await db.wallet.findFirst({ where: { id, userId: user.id } });
  if (!wallet) {
    return NextResponse.json(makeError("NOT_FOUND", "Wallet not found", "This wallet connection does not exist.", 404), { status: 404 });
  }
  // Disconnect: stop future indexing (FR-CHAIN-001), preserve audit history
  await db.wallet.update({ where: { id }, data: { disconnectedAt: new Date() } });
  await db.auditEvent.create({
    data: {
      userId: user.id,
      actor: user.id,
      action: "wallet_disconnected",
      resourceType: "wallet",
      resourceId: wallet.id,
    },
  });
  return NextResponse.json({ ok: true });
}
