import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { checkSolanaBoundary } from "@/lib/solana";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const wallets = await db.wallet.findMany({
    where: { userId: user.id },
    include: { tokenAccounts: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    wallets,
    boundary: checkSolanaBoundary(),
  });
}
