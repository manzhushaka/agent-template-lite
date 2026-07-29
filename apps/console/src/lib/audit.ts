import { auditLogs } from "@/db/schema";
import type { SessionUser } from "./auth";
import { db } from "./db";

/** Keep audit writes beside the successful business transaction whenever atomicity matters. */
export async function audit(user: SessionUser | null, input: { action: string; resourceType: string; resourceId?: string; detail?: unknown }) {
  await db.insert(auditLogs).values({
    userId: user?.id,
    actor: user?.username || "internal-agent",
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    detail: input.detail,
  });
}
