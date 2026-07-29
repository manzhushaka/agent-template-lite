import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { listOrders } from "@/lib/demo-service";
import { paginationInput, paginationSchema } from "@/lib/pagination";

export async function GET(request: Request) {
  if (!await readSession()) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const pagination = paginationSchema.safeParse(
    paginationInput(new URL(request.url).searchParams),
  );
  if (!pagination.success) {
    return NextResponse.json({ message: "分页参数无效" }, { status: 400 });
  }
  return NextResponse.json(await listOrders(pagination.data));
}
