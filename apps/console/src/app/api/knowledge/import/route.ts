import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { readSession } from "@/lib/auth";
import { parseKnowledgeImport } from "@/lib/knowledge-import";
import { createKnowledge } from "@/lib/knowledge-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await readSession();
  if (!user) return NextResponse.json({ message: "未登录" }, { status: 401 });
  try {
    const imported = await parseKnowledgeImport(await request.formData());
    const result = await createKnowledge(imported, user.username);
    await audit(user, {
      action: "IMPORT",
      resourceType: "knowledge_document",
      resourceId: String(result.documentId),
      detail: { sourceType: imported.sourceType, sourceHash: imported.sourceHash, jobId: result.jobId },
    });
    return NextResponse.json({ ...result, message: "知识已导入，索引任务已创建" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "知识导入失败" }, { status: 400 });
  }
}
