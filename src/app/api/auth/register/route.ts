import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, createSession, setSessionCookie, describeDevice } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(80).optional(),
  baseCurrency: z.string().length(3).default("USD"),
  locale: z.string().default("en"),
  timezone: z.string().default("UTC"),
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
  const { email, password, displayName, baseCurrency, locale, timezone } = parsed.data;

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    // FR-AUTH-001: no account enumeration — return generic message
    return NextResponse.json(
      makeError("AUTH_ACCOUNT_EXISTS", "Registration failed", "We couldn't create your account with those details.", 409),
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      displayName,
      baseCurrency,
      locale,
      timezone,
    },
  });

  // Seed default categories
  await db.category.createMany({
    data: [
      { name: "Groceries", kind: "expense", userId: user.id, isSystem: true },
      { name: "Dining", kind: "expense", userId: user.id, isSystem: true },
      { name: "Transport", kind: "expense", userId: user.id, isSystem: true },
      { name: "Subscriptions", kind: "expense", userId: user.id, isSystem: true },
      { name: "Housing", kind: "expense", userId: user.id, isSystem: true },
      { name: "Utilities", kind: "expense", userId: user.id, isSystem: true },
      { name: "Healthcare", kind: "expense", userId: user.id, isSystem: true },
      { name: "Shopping", kind: "expense", userId: user.id, isSystem: true },
      { name: "Cash", kind: "expense", userId: user.id, isSystem: true },
      { name: "Transfers", kind: "transfer", userId: user.id, isSystem: true },
      { name: "Income", kind: "income", userId: user.id, isSystem: true },
      { name: "Other Income", kind: "income", userId: user.id, isSystem: true },
      { name: "Uncategorized", kind: "expense", userId: user.id, isSystem: true },
    ],
  });

  const device = describeDevice(req.headers.get("user-agent"));
  const { token, expiresAt } = await createSession(user.id, device);
  await setSessionCookie(token, expiresAt);
  await recordAudit({
    userId: user.id,
    actor: "user",
    action: "auth.register",
    resourceType: "User",
    resourceId: user.id,
    metadata: { baseCurrency, locale, timezone },
  });

  return NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.displayName, baseCurrency: user.baseCurrency },
  });
}
