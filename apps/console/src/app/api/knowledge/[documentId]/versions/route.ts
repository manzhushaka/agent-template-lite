import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { knowledgeDocumentVersions } from "@/db/schema";
import { readSession } from "@/lib/auth";
import { db } from "@/lib/db";

type Context = { params: Promise<{ documentId: string }> };

export async function GET(_: Request, context: Context) {
  if (!await readSession()) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const documentId = Number((await context.params).documentId);
  if (!Number.isInteger(documentId) || documentId <= 0) return NextResponse.json({ message: "文档 ID 无效" }, { status: 400 });
  const items = await db.select({
    id: knowledgeDocumentVersions.id,
    version: knowledgeDocumentVersions.version,
    title: knowledgeDocumentVersions.title,
    source: knowledgeDocumentVersions.source,
    sourceType: knowledgeDocumentVersions.sourceType,
    sourceHash: knowledgeDocumentVersions.sourceHash,
    status: knowledgeDocumentVersions.status,
    createdBy: knowledgeDocumentVersions.createdBy,
    createdAt: knowledgeDocumentVersions.createdAt,
  }).from(knowledgeDocumentVersions)
    .where(eq(knowledgeDocumentVersions.documentId, documentId))
    .orderBy(desc(knowledgeDocumentVersions.version));
  return NextResponse.json({ items });
}
