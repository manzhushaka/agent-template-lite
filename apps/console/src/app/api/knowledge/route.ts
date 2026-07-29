import { count, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { knowledgeDocuments } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requestKnowledgeReindex } from "@/lib/agentos";
import { readSession } from "@/lib/auth";
import { db } from "@/lib/db";
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
      .select()
      .from(knowledgeDocuments)
      .where(condition)
      .orderBy(desc(knowledgeDocuments.updatedAt), desc(knowledgeDocuments.id))
      .limit(pagination.pageSize)
      .offset(paginationOffset(pagination)),
  ]);
  const total = Number(totalRow.value);
  return { items, pagination: paginationMeta(pagination, total) };
}

async function reindexPublished(): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await requestKnowledgeReindex() as { indexedIds?: number[] };
    if (result.indexedIds?.length) await db.update(knowledgeDocuments).set({ indexStatus: "READY" }).where(inArray(knowledgeDocuments.id, result.indexedIds));
    return { ok: true, message: "向量索引已更新" };
  } catch (error) {
    return { ok: false, message: `文档已保存，等待 AgentOS 重建索引：${(error as Error).message}` };
  }
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
  const [result] = await db.insert(knowledgeDocuments).values({ ...parsed.data, indexStatus: "PENDING" });
  await audit(user, { action: "CREATE", resourceType: "knowledge_document", resourceId: String(result.insertId), detail: { title: parsed.data.title } });
  const indexing = parsed.data.status === "PUBLISHED" ? await reindexPublished() : { ok: true, message: "草稿未进入索引" };
  return NextResponse.json({ id: Number(result.insertId), indexing }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await readSession();
  if (!user) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.id) return NextResponse.json({ message: "请检查知识内容和 ID" }, { status: 400 });
  const { id, ...value } = parsed.data;
  await db.update(knowledgeDocuments).set({ ...value, version: sql`${knowledgeDocuments.version} + 1`, indexStatus: "PENDING" }).where(eq(knowledgeDocuments.id, id));
  await audit(user, { action: "UPDATE", resourceType: "knowledge_document", resourceId: String(id), detail: { title: value.title } });
  const indexing = value.status === "PUBLISHED" ? await reindexPublished() : { ok: true, message: "草稿已从发布集合移除，建议重建索引" };
  return NextResponse.json({ id, indexing });
}

export async function PATCH() {
  const user = await readSession();
  if (!user) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const indexing = await reindexPublished();
  await audit(user, { action: "REINDEX", resourceType: "knowledge_document", detail: indexing });
  return NextResponse.json({ indexing }, { status: indexing.ok ? 200 : 502 });
}
