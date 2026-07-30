import { count, desc, eq, like, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { knowledgeDocuments } from "@/db/schema";
import { audit } from "@/lib/audit";
import { readSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createKnowledge,
  enqueueKnowledgeIndex,
  updateKnowledge,
} from "@/lib/knowledge-service";
import {
  paginationInput,
  paginationMeta,
  paginationOffset,
  paginationSchema,
  type PaginationQuery,
} from "@/lib/pagination";

const schema = z.object({
  id: z.coerce.number().int().positive().optional(), title: z.string().trim().min(1).max(200), category: z.string().trim().min(1).max(80),
  content: z.string().trim().min(20).max(100_000), source: z.string().trim().min(1).max(200), status: z.enum(["DRAFT", "PUBLISHED"]),
});

async function listKnowledge(query: string, pagination: PaginationQuery) {
  const term = query.trim();
  const condition = term
    ? or(
        like(knowledgeDocuments.title, `%${term}%`),
        like(knowledgeDocuments.category, `%${term}%`),
        like(knowledgeDocuments.source, `%${term}%`),
      )
    : undefined;
  const [[totalRow], items] = await Promise.all([
    db.select({ value: count() }).from(knowledgeDocuments).where(condition),
    db
      .select({
        id: knowledgeDocuments.id,
        title: knowledgeDocuments.title,
        category: knowledgeDocuments.category,
        content: knowledgeDocuments.content,
        source: knowledgeDocuments.source,
        sourceType: knowledgeDocuments.sourceType,
        sourceUri: knowledgeDocuments.sourceUri,
        sourceHash: knowledgeDocuments.sourceHash,
        mimeType: knowledgeDocuments.mimeType,
        fileName: knowledgeDocuments.fileName,
        fileSize: knowledgeDocuments.fileSize,
        status: knowledgeDocuments.status,
        version: knowledgeDocuments.version,
        indexStatus: knowledgeDocuments.indexStatus,
        indexError: knowledgeDocuments.indexError,
        indexedAt: knowledgeDocuments.indexedAt,
        updatedAt: knowledgeDocuments.updatedAt,
        createdAt: knowledgeDocuments.createdAt,
        latestJobId: sql<number | null>`(SELECT MAX(job.id) FROM knowledge_index_job job WHERE job.document_id = ${knowledgeDocuments.id})`,
      })
      .from(knowledgeDocuments)
      .where(condition)
      .orderBy(desc(knowledgeDocuments.updatedAt), desc(knowledgeDocuments.id))
      .limit(pagination.pageSize)
      .offset(paginationOffset(pagination)),
  ]);
  const total = Number(totalRow.value);
  return { items, pagination: paginationMeta(pagination, total) };
}

export async function GET(request: Request) {
  if (!await readSession()) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const url = new URL(request.url);
  const pagination = paginationSchema.safeParse(paginationInput(url.searchParams));
  const query = z.string().trim().max(200).safeParse(url.searchParams.get("q") || "");
  if (!pagination.success || !query.success) {
    return NextResponse.json({ message: "分页或搜索参数无效" }, { status: 400 });
  }
  return NextResponse.json(await listKnowledge(query.data, pagination.data));
}

export async function POST(request: Request) {
  const user = await readSession();
  if (!user) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "请检查知识内容" }, { status: 400 });
  const result = await createKnowledge({ ...parsed.data, sourceType: "MANUAL" }, user.username);
  await audit(user, { action: "CREATE", resourceType: "knowledge_document", resourceId: String(result.documentId), detail: { title: parsed.data.title, jobId: result.jobId } });
  return NextResponse.json({ id: result.documentId, jobId: result.jobId, message: "知识已保存，索引任务已创建" }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await readSession();
  if (!user) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.id) return NextResponse.json({ message: "请检查知识内容和 ID" }, { status: 400 });
  const { id, ...value } = parsed.data;
  const [current] = await db.select().from(knowledgeDocuments).where(eq(knowledgeDocuments.id, id)).limit(1);
  if (!current) return NextResponse.json({ message: "知识文档不存在" }, { status: 404 });
  const result = await updateKnowledge(id, {
    ...value,
    sourceType: current.sourceType,
    sourceUri: current.sourceUri,
    sourceHash: current.sourceHash,
    mimeType: current.mimeType,
    fileName: current.fileName,
    fileSize: current.fileSize,
  }, user.username);
  await audit(user, { action: "UPDATE", resourceType: "knowledge_document", resourceId: String(id), detail: { title: value.title, version: result.version, jobId: result.jobId } });
  return NextResponse.json({ id, jobId: result.jobId, message: "知识已更新，索引任务已创建" });
}

export async function PATCH() {
  const user = await readSession();
  if (!user) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const jobId = await enqueueKnowledgeIndex(null, null, user.username);
  await audit(user, { action: "REINDEX_REQUEST", resourceType: "knowledge_document", detail: { jobId } });
  return NextResponse.json({ jobId, message: "全量索引任务已创建" }, { status: 202 });
}
