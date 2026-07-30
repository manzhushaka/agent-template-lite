import { NextResponse } from "next/server";
import { agentosRequest } from "@/lib/agentos";
import { readSession } from "@/lib/auth";

type Context = { params: Promise<{ documentId: string }> };

export async function GET(_: Request, context: Context) {
  if (!await readSession()) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const documentId = Number((await context.params).documentId);
  if (!Number.isInteger(documentId) || documentId <= 0) return NextResponse.json({ message: "文档 ID 无效" }, { status: 400 });
  try {
    return NextResponse.json(await agentosRequest(`/api/admin/knowledge/${documentId}/chunks`));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "切片读取失败" }, { status: 502 });
  }
}
