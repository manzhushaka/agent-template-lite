import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { listOrders } from "@/lib/demo-service";

export async function GET() {
  if (!await readSession()) return NextResponse.json({ message: "未登录" }, { status: 401 });
  return NextResponse.json({ items: await listOrders() });
}
