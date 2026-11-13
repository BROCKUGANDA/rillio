/**
 * Rillio — centralized audit trail writer.
 *
 * Every security-relevant action (auth, imports, connections, billing,
 * wallets, exports, deletions, category overrides) must append an immutable
 * AuditEvent. The trail is append-only from the product's perspective: no API
 * mutates or deletes audit rows; deletion of the owning user nulls the user
 * link but keeps the event (onDelete: SetNull) for compliance forensics.
 */

import { db } from "@/lib/db";

export type AuditActor = "user" | "system" | "provider" | "admin";

export type AuditInput = {
  userId: string | null;
  actor: AuditActor;
  action: string; // e.g. "auth.login", "import.created", "billing.payment_verified"
  resourceType: string; // e.g. "User", "ImportJob", "Subscription"
  resourceId?: string | null;
  reason?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Fire-and-forget audit write. Never throws into the caller's happy path —
 * a failed audit append is logged but must not break the user action.
 * Returns the event id (or null if the write failed).
 */
export async function recordAudit(input: AuditInput): Promise<string | null> {
  try {
    const ev = await db.auditEvent.create({
      data: {
        userId: input.userId,
        actor: input.actor,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        reason: input.reason ?? null,
        requestId: input.requestId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
    return ev.id;
  } catch (err) {
    console.error("[audit] failed to persist audit event", {
      action: input.action,
      resourceType: input.resourceType,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Structured log line — one JSON object per line, greppable by requestId. */
export function logEvent(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
