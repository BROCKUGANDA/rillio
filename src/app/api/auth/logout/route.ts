import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionCookie, hashToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

export async function POST() {
  // Revoke the exact session row (not just the cookie) so the device
  // disappears from the security view's active-session list.
  const store = await cookies();
  const token = store.get("rillio_session")?.value;
  if (token) {
    const tokenHash = hashToken(token);
    const session = await db.session.findUnique({ where: { tokenHash } });
    if (session && !session.revokedAt) {
      await db.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      await recordAudit({
        userId: session.userId,
        actor: "user",
        action: "auth.logout",
        resourceType: "Session",
        resourceId: session.id,
      });
    }
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
