import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { getActiveSubscription } from "@/lib/billing/entitlements";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const sub = await getActiveSubscription(user.id);
  if (!sub) {
    return NextResponse.json({ invoices: [] });
  }
  const invoices = await db.invoice.findMany({
    where: { subscriptionId: sub.id },
    orderBy: { createdAt: "desc" },
    take: 24,
  });
  return NextResponse.json({
    invoices: invoices.map((i) => ({
      ...i,
      amountMinor: i.amountMinor.toString(),
    })),
  });
}
