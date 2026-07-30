import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { chatSessions } from "@/db/schema";
import { db } from "./db";

function visitorHash(visitorId: string): string {
  return createHash("sha256").update(visitorId).digest("hex");
}

export async function listChatSessions(visitorId: string) {
  return db.select({
    id: chatSessions.sessionId,
    title: chatSessions.title,
    updatedAt: chatSessions.lastActiveAt,
  }).from(chatSessions).where(and(
    eq(chatSessions.visitorHash, visitorHash(visitorId)),
    eq(chatSessions.status, "ACTIVE"),
  )).orderBy(desc(chatSessions.lastActiveAt)).limit(50);
}

export async function createChatSession(visitorId: string) {
  const sessionId = randomUUID();
  await db.insert(chatSessions).values({ sessionId, visitorHash: visitorHash(visitorId) });
  return { id: sessionId, title: "新会话", updatedAt: new Date().toISOString() };
}

export async function ownsChatSession(visitorId: string, sessionId: string) {
  const [session] = await db.select({ id: chatSessions.id }).from(chatSessions).where(and(
    eq(chatSessions.sessionId, sessionId),
    eq(chatSessions.visitorHash, visitorHash(visitorId)),
    eq(chatSessions.status, "ACTIVE"),
  )).limit(1);
  return Boolean(session);
}

export async function renameChatSession(visitorId: string, sessionId: string, title: string) {
  const [result] = await db.update(chatSessions).set({ title, lastActiveAt: new Date() }).where(and(
    eq(chatSessions.sessionId, sessionId),
    eq(chatSessions.visitorHash, visitorHash(visitorId)),
    eq(chatSessions.status, "ACTIVE"),
  ));
  return result.affectedRows > 0;
}

export async function touchChatSession(visitorId: string, sessionId: string) {
  const [result] = await db.update(chatSessions).set({ lastActiveAt: new Date() }).where(and(
    eq(chatSessions.sessionId, sessionId),
    eq(chatSessions.visitorHash, visitorHash(visitorId)),
    eq(chatSessions.status, "ACTIVE"),
  ));
  return result.affectedRows > 0;
}

export async function deleteChatSession(visitorId: string, sessionId: string) {
  const [result] = await db.update(chatSessions).set({ status: "DELETED", lastActiveAt: new Date() }).where(and(
    eq(chatSessions.sessionId, sessionId),
    eq(chatSessions.visitorHash, visitorHash(visitorId)),
    eq(chatSessions.status, "ACTIVE"),
  ));
  return result.affectedRows > 0;
}
