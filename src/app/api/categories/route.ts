import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const categories = await db.category.findMany({
    where: { userId: user.id },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to continue.", 401), { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { name, kind } = body as { name?: string; kind?: string };
  if (!name) {
    return NextResponse.json(makeError("VALIDATION_ERROR", "Missing name", "Category name is required.", 422), { status: 422 });
  }
  const cat = await db.category.create({
    data: {
      userId: user.id,
      name: name.slice(0, 60),
      kind: ["expense", "income", "transfer", "ignore"].includes(kind ?? "") ? kind! : "expense",
    },
  });
  return NextResponse.json({ category: cat });
}
