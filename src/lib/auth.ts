/**
 * Auth helpers — secure HttpOnly SameSite cookies, hashed session tokens,
 * server revocation, bcrypt-style password hashing.
 *
 * Per blueprint §4.1 FR-AUTH-001 and Phase 3.
 */

import { compare, genSalt, hash } from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "./db";
import { createHash, randomBytes } from "crypto";

const SESSION_COOKIE = "rillio_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(plain: string): Promise<string> {
  const salt = await genSalt(12);
  return hash(plain, salt);
}

export async function verifyPassword(
  plain: string,
  hashed: string
): Promise<boolean> {
  return compare(plain, hashed);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      deviceInfo: "web",
    },
  });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<{
  id: string;
  email: string;
  displayName: string | null;
  baseCurrency: string;
  locale: string;
  timezone: string;
} | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = hashToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    baseCurrency: session.user.baseCurrency,
    locale: session.user.locale,
    timezone: session.user.timezone,
  };
}

export async function requireUser(): Promise<{
  id: string;
  email: string;
  displayName: string | null;
  baseCurrency: string;
  locale: string;
  timezone: string;
}> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("AUTH_REQUIRED");
  }
  return user;
}

export async function revokeSession(sessionId: string) {
  await db.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string) {
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
