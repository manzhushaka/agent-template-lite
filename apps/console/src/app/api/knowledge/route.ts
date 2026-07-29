import { desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { knowledgeDocuments } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requestKnowledgeReindex } from "@/lib/agentos";
import { readSession } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  id: z.coerce.number().int().positive().optional(), title: z.string().trim().min(1).max(200), category: z.string().trim().min(1).max(80),
  content: z.string().trim().min(20).max(100_000), source: z.string().trim().min(1).max(200), status: z.enum(["DRAFT", "PUBLISHED"]),
});

async function items() { return db.select().from(knowledgeDocuments).orderBy(desc(knowledgeDocuments.updatedAt)); }

async function reindexPublished(): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await requestKnowledgeReindex() as { indexedIds?: number[] };
    if (result.indexedIds?.length) await db.update(knowledgeDocuments).set({ indexStatus: "READY" }).where(inArray(knowledgeDocuments.id, result.indexedIds));
    return { ok: true, message: "向量索引已更新" };
  } catch (error) {
    return { ok: false, message: `文档已保存，等待 AgentOS 重建索引：${(error as Error).message}` };
  }
}

export async function GET() {
  if (!await readSession()) return NextResponse.json({ message: "未登录" }, { status: 401 });
  return NextResponse.json({ items: await items() });
}

export async function POST(request: Request) {
  const user = await readSession();
  if (!user) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "请检查知识内容" }, { status: 400 });
  const [result] = await db.insert(knowledgeDocuments).values({ ...parsed.data, indexStatus: "PENDING" });
  await audit(user, { action: "CREATE", resourceType: "knowledge_document", resourceId: String(result.insertId), detail: { title: parsed.data.title } });
  const indexing = parsed.data.status === "PUBLISHED" ? await reindexPublished() : { ok: true, message: "草稿未进入索引" };
  return NextResponse.json({ items: await items(), indexing }, { status: 201 });
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
  return NextResponse.json({ items: await items(), indexing });
}

export async function PATCH() {
  const user = await readSession();
  if (!user) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const indexing = await reindexPublished();
  await audit(user, { action: "REINDEX", resourceType: "knowledge_document", detail: indexing });
  return NextResponse.json({ items: await items(), indexing }, { status: indexing.ok ? 200 : 502 });
}
