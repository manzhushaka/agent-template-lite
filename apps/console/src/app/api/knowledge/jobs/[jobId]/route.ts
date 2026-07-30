import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { readSession } from "@/lib/auth";
import { processKnowledgeIndexJob } from "@/lib/knowledge-service";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(_: Request, context: Context) {
  const user = await readSession();
  if (!user) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const jobId = Number((await context.params).jobId);
  if (!Number.isInteger(jobId) || jobId <= 0) return NextResponse.json({ message: "索引任务 ID 无效" }, { status: 400 });
  try {
    const result = await processKnowledgeIndexJob(jobId);
    await audit(user, { action: "REINDEX_SUCCESS", resourceType: "knowledge_index_job", resourceId: String(jobId), detail: result });
    return NextResponse.json({ ...result, message: "知识索引已更新" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "知识索引失败";
    await audit(user, { action: "REINDEX_FAILED", resourceType: "knowledge_index_job", resourceId: String(jobId), detail: { message } });
    return NextResponse.json({ message }, { status: 502 });
  }
}
