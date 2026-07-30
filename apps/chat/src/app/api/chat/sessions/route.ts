import { NextResponse } from "next/server";
import { consoleChatRequest } from "@/lib/server-clients";
import { visitorCookie, visitorIdentity } from "@/lib/visitor";

export async function GET(request: Request) {
  const visitor = visitorIdentity(request);
  try {
    const body = await consoleChatRequest(`/api/internal/chat/sessions?visitorId=${encodeURIComponent(visitor.id)}`);
    const response = NextResponse.json({ items: body.items || [] });
    if (visitor.isNew) response.headers.append("set-cookie", visitorCookie(visitor));
    return response;
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "会话列表加载失败" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const visitor = visitorIdentity(request);
  try {
    const body = await consoleChatRequest("/api/internal/chat/sessions", { method: "POST", body: JSON.stringify({ visitorId: visitor.id }) });
    const response = NextResponse.json(body, { status: 201 });
    if (visitor.isNew) response.headers.append("set-cookie", visitorCookie(visitor));
    return response;
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "会话创建失败" }, { status: 502 });
  }
}
