import { NextResponse } from "next/server";
import { agentosRequest } from "@/lib/agentos";
import { readSession } from "@/lib/auth";
import { paginationInput, paginationSchema } from "@/lib/pagination";

export async function GET(request: Request) {
  if (!await readSession()) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const parsed = paginationSchema.safeParse(paginationInput(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ message: "分页参数无效" }, { status: 400 });
  try {
    return NextResponse.json(await agentosRequest(`/api/admin/observability?page=${parsed.data.page}&page_size=${parsed.data.pageSize}`));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "运行数据不可用" }, { status: 502 });
  }
}
