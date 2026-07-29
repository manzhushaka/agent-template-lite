import { NextResponse } from "next/server";
import { agentosRequest } from "@/lib/agentos";
import { readSession } from "@/lib/auth";

export async function GET() {
  if (!await readSession()) return NextResponse.json({ message: "未登录" }, { status: 401 });
  try { return NextResponse.json(await agentosRequest("/api/admin/overview")); }
  catch (error) { return NextResponse.json({ message: (error as Error).message }, { status: 502 }); }
}
