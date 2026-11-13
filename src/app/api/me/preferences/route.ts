import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.displayName === "string") update.displayName = body.displayName.slice(0, 80);
  if (typeof body.baseCurrency === "string" && body.baseCurrency.length === 3) update.baseCurrency = body.baseCurrency.toUpperCase();
  if (typeof body.locale === "string") update.locale = body.locale;
  if (typeof body.timezone === "string") update.timezone = body.timezone;
  const updated = await db.user.update({ where: { id: user.id }, data: update });
  return NextResponse.json({
    user: {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      baseCurrency: updated.baseCurrency,
      locale: updated.locale,
      timezone: updated.timezone,
    },
  });
}
