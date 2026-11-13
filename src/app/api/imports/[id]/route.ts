import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const { id } = await params;
  const job = await db.importJob.findFirst({
    where: { id, userId: user.id },
  });
  if (!job) {
    return NextResponse.json(makeError("NOT_FOUND", "Import not found", "This import job does not exist.", 404), { status: 404 });
  }
  return NextResponse.json({ import: job });
}
