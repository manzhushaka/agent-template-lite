import { NextResponse } from "next/server";
import { consoleChatRequest } from "@/lib/server-clients";
import { visitorCookie, visitorIdentity } from "@/lib/visitor";

export async function GET(request: Request) {
  try {
    const visitor = visitorIdentity(request);
    const body = await consoleChatRequest(`/api/internal/chat/sessions?visitorId=${encodeURIComponent(visitor.id)}`);
    const response = NextResponse.json({ sessions: body.items || [] });
    if (visitor.isNew) response.headers.append("set-cookie", visitorCookie(visitor));
    return response;
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "会话初始化失败" }, { status: 502 });
  }
}
