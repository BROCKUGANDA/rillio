import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";
import { listProviders } from "@/lib/providers/registry";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const providers = listProviders();
  const connections = await db.financialConnection.findMany({
    where: { userId: user.id },
  });
  return NextResponse.json({
    providers: providers.map((p) => ({
      ...p,
      connections: connections.filter((c) => c.provider === p.code && !c.revokedAt),
    })),
  });
}
