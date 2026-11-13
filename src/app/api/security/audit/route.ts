/**
 * GET /api/security/audit — the user's security-relevant event trail.
 *
 * Enterprise-audit surface: paginated, filterable by action group and
 * resource type, with a summary block for posture cards. Events are
 * append-only; this route never mutates them.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { makeError } from "@/lib/errors";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(makeError("AUTH_REQUIRED", "Authentication required", "Sign in to view your audit trail.", 401), { status: 401 });
  }

  const url = new URL(req.url);
  const group = url.searchParams.get("group"); // auth | data | connections | billing | wallets | goals
  const cursor = url.searchParams.get("cursor"); // ISO date of last event for keyset pagination
  const q = url.searchParams.get("q"); // free-text over action/resource

  // Keyset pagination on createdAt — stable under concurrent appends.
  const where: {
    userId: string;
    action?: { startsWith: string };
    resourceType?: { in: string[] };
    OR?: { action: { contains: string } }[] | { resourceType: { contains: string } }[];
    createdAt?: { lt: Date };
  } = { userId: user.id };

  if (group) {
    const prefixes: Record<string, string[]> = {
      auth: ["auth."],
      data: ["import.", "data.", "transaction."],
      connections: ["connection.", "consent."],
      billing: ["billing."],
      wallets: ["wallet."],
      goals: ["goal."],
    };
    const prefixList = prefixes[group];
    if (prefixList) {
      where.OR = prefixList.flatMap((p) => [
        { action: { contains: p } as never },
      ] as never);
    }
  }
  if (q) {
    where.OR = [{ action: { contains: q } } as never, { resourceType: { contains: q } } as never];
  }
  if (cursor && !isNaN(Date.parse(cursor))) {
    where.createdAt = { lt: new Date(cursor) };
  }

  const [events, total] = await Promise.all([
    db.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
    }),
    db.auditEvent.count({ where: { userId: user.id } }),
  ]);

  const hasMore = events.length > PAGE_SIZE;
  const page = events.slice(0, PAGE_SIZE);
  const nextCursor = hasMore ? page[page.length - 1].createdAt.toISOString() : null;

  // Summary counts by group for the posture cards.
  const all = await db.auditEvent.findMany({
    where: { userId: user.id },
    select: { action: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  const counts: Record<string, number> = { auth: 0, data: 0, connections: 0, billing: 0, wallets: 0, goals: 0, other: 0 };
  const groupPrefixes: Record<string, string[]> = {
    auth: ["auth."],
    data: ["import.", "data.", "transaction."],
    connections: ["connection.", "consent."],
    billing: ["billing."],
    wallets: ["wallet."],
    goals: ["goal."],
  };
  for (const ev of all) {
    let matched = false;
    for (const [g, prefixes] of Object.entries(groupPrefixes)) {
      if (prefixes.some((p) => ev.action.startsWith(p))) {
        counts[g] += 1;
        matched = true;
        break;
      }
    }
    if (!matched) counts.other += 1;
  }

  return NextResponse.json({
    events: page.map((e) => ({
      id: e.id,
      action: e.action,
      actor: e.actor,
      resourceType: e.resourceType,
      resourceId: e.resourceId,
      reason: e.reason,
      requestId: e.requestId,
      metadata: e.metadata ? (JSON.parse(e.metadata) as Record<string, unknown>) : null,
      createdAt: e.createdAt.toISOString(),
    })),
    nextCursor,
    hasMore,
    summary: {
      total,
      counts,
      lastEventAt: all[0]?.createdAt?.toISOString() ?? null,
      window: all.length >= 1000 ? "latest_1000" : "all",
    },
  });
}
