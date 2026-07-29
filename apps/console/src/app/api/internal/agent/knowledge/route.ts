import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { knowledgeDocuments } from "@/db/schema";
import { internalAuthorized } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  if (!internalAuthorized(request)) return NextResponse.json({ message: "forbidden" }, { status: 403 });
  try {
    const documents = await db.select({ id: knowledgeDocuments.id, title: knowledgeDocuments.title, category: knowledgeDocuments.category, content: knowledgeDocuments.content, source: knowledgeDocuments.source, version: knowledgeDocuments.version })
      .from(knowledgeDocuments).where(eq(knowledgeDocuments.status, "PUBLISHED"));
    return NextResponse.json({ documents });
  } catch {
    return NextResponse.json({ code: "KNOWLEDGE_SOURCE_UNAVAILABLE", message: "知识源暂时不可用" }, { status: 503 });
  }
}
