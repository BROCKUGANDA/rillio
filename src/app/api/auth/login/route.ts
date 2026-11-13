import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";
import { makeError } from "@/lib/errors";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(makeError("VALIDATION_ERROR", "Invalid JSON", "Request body is not valid JSON.", 400), { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      makeError("VALIDATION_ERROR", "Validation failed", "Please correct the highlighted fields.", 422, {
        fieldErrors: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          code: i.code,
          message: i.message,
        })),
      }),
      { status: 422 }
    );
  }
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  // FR-AUTH-001: no account enumeration — same generic error
  if (!user) {
    return NextResponse.json(
      makeError("AUTH_INVALID_CREDENTIALS", "Sign in failed", "Check your email and password and try again.", 401, { retryable: false }),
      { status: 401 }
    );
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      makeError("AUTH_INVALID_CREDENTIALS", "Sign in failed", "Check your email and password and try again.", 401, { retryable: false }),
      { status: 401 }
    );
  }

  const { token, expiresAt } = await createSession(user.id);
  await setSessionCookie(token, expiresAt);

  return NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.displayName, baseCurrency: user.baseCurrency, locale: user.locale, timezone: user.timezone },
  });
}
