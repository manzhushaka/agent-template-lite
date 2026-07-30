import { and, eq, inArray, sql } from "drizzle-orm";
import type { RowDataPacket } from "mysql2";
import {
  knowledgeDocuments,
  knowledgeDocumentVersions,
  knowledgeIndexJobs,
} from "@/db/schema";
import { requestKnowledgeReindex } from "./agentos";
import { db, pool } from "./db";

export interface KnowledgeWrite {
  title: string;
  category: string;
  content: string;
  source: string;
  sourceType: "MANUAL" | "FILE" | "WEB";
  sourceUri?: string | null;
  sourceHash?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  status: "DRAFT" | "PUBLISHED";
}

export async function createKnowledge(value: KnowledgeWrite, actor: string) {
  return db.transaction(async (tx) => {
    const normalized = {
      ...value,
      sourceUri: value.sourceUri || null,
      sourceHash: value.sourceHash || null,
      mimeType: value.mimeType || null,
      fileName: value.fileName || null,
      fileSize: value.fileSize || null,
    };
    const [result] = await tx.insert(knowledgeDocuments).values({ ...normalized, indexStatus: "PENDING" });
    const documentId = Number(result.insertId);
    await tx.insert(knowledgeDocumentVersions).values({ documentId, version: 1, ...normalized, createdBy: actor });
    const [job] = await tx.insert(knowledgeIndexJobs).values({ documentId, targetVersion: 1, requestedBy: actor });
    return { documentId, version: 1, jobId: Number(job.insertId) };
  });
}

export async function updateKnowledge(documentId: number, value: KnowledgeWrite, actor: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM knowledge_document WHERE id = ${documentId} FOR UPDATE`);
    const [current] = await tx.select({ version: knowledgeDocuments.version })
      .from(knowledgeDocuments).where(eq(knowledgeDocuments.id, documentId)).limit(1);
    if (!current) throw new Error("知识文档不存在");
    const version = current.version + 1;
    const normalized = {
      ...value,
      sourceUri: value.sourceUri || null,
      sourceHash: value.sourceHash || null,
      mimeType: value.mimeType || null,
      fileName: value.fileName || null,
      fileSize: value.fileSize || null,
    };
    await tx.update(knowledgeDocuments).set({ ...normalized, version, indexStatus: "PENDING", indexError: null })
      .where(eq(knowledgeDocuments.id, documentId));
    await tx.insert(knowledgeDocumentVersions).values({ documentId, version, ...normalized, createdBy: actor });
    const [job] = await tx.insert(knowledgeIndexJobs).values({ documentId, targetVersion: version, requestedBy: actor });
    return { documentId, version, jobId: Number(job.insertId) };
  });
}

export async function enqueueKnowledgeIndex(documentId: number | null, targetVersion: number | null, actor: string) {
  const [result] = await db.insert(knowledgeIndexJobs).values({
    documentId,
    targetVersion,
    requestedBy: actor,
  });
  if (documentId) {
    await db.update(knowledgeDocuments).set({ indexStatus: "PENDING", indexError: null })
      .where(eq(knowledgeDocuments.id, documentId));
  }
  return Number(result.insertId);
}

export async function processKnowledgeIndexJob(jobId: number) {
  const lockConnection = await pool.getConnection();
  interface LockRow extends RowDataPacket { acquired: number }
  const [lockRows] = await lockConnection.query<LockRow[]>(
    "SELECT GET_LOCK('agent_template_knowledge_index', 0) AS acquired",
  );
  if (lockRows[0]?.acquired !== 1) {
    lockConnection.release();
    throw new Error("已有索引任务正在执行，请稍后重试");
  }
  try {
    const [job] = await db.select().from(knowledgeIndexJobs)
      .where(and(
        eq(knowledgeIndexJobs.id, jobId),
        inArray(knowledgeIndexJobs.status, ["PENDING", "FAILED"]),
      )).limit(1);
    if (!job) throw new Error("索引任务不存在或已经处理");

    await db.update(knowledgeIndexJobs).set({
      status: "RUNNING",
      attempts: sql`${knowledgeIndexJobs.attempts} + 1`,
      lastError: null,
      startedAt: new Date(),
      finishedAt: null,
    }).where(eq(knowledgeIndexJobs.id, jobId));
    if (job.documentId) {
      await db.update(knowledgeDocuments).set({ indexStatus: "INDEXING", indexError: null })
        .where(eq(knowledgeDocuments.id, job.documentId));
    }

    try {
      const result = await requestKnowledgeReindex() as { indexedIds?: number[] };
      const indexedIds = result.indexedIds || [];
      const now = new Date();
      await db.update(knowledgeDocuments).set({ indexStatus: "READY", indexError: null, indexedAt: now });
      await db.update(knowledgeIndexJobs).set({ status: "SUCCEEDED", finishedAt: now })
        .where(eq(knowledgeIndexJobs.id, jobId));
      return { indexedIds, count: indexedIds.length };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 2000) : "索引服务异常";
      if (job.documentId) {
        await db.update(knowledgeDocuments).set({ indexStatus: "ERROR", indexError: message })
          .where(eq(knowledgeDocuments.id, job.documentId));
      }
      await db.update(knowledgeIndexJobs).set({ status: "FAILED", lastError: message, finishedAt: new Date() })
        .where(eq(knowledgeIndexJobs.id, jobId));
      throw new Error(message);
    }
  } finally {
    await lockConnection.query("SELECT RELEASE_LOCK('agent_template_knowledge_index')");
    lockConnection.release();
  }
}
