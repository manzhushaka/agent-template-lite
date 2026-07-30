import { NextResponse } from "next/server";
import { agentosAdminRequest, assertSessionOwner, consoleChatRequest } from "@/lib/server-clients";
import { visitorIdentity } from "@/lib/visitor";

type Context = { params: Promise<{ sessionId: string }> };

export async function PATCH(request: Request, context: Context) {
  const visitor = visitorIdentity(request);
  const sessionId = (await context.params).sessionId;
  const payload: unknown = await request.json().catch(() => null);
  const title = payload && typeof payload === "object" && "title" in payload && typeof payload.title === "string"
    ? payload.title.trim()
    : "";
  if (!title || title.length > 120) return NextResponse.json({ message: "会话标题无效" }, { status: 400 });
  try {
    await assertSessionOwner(visitor.id, sessionId);
    await consoleChatRequest(`/api/internal/chat/sessions/${encodeURIComponent(sessionId)}`, { method: "PATCH", body: JSON.stringify({ visitorId: visitor.id, title }) });
    await agentosAdminRequest(`/sessions/${encodeURIComponent(sessionId)}/rename?type=agent&user_id=${encodeURIComponent(visitor.id)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ session_name: title }) }).catch(() => null);
    return NextResponse.json({ id: sessionId, title });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "会话重命名失败" }, { status: 404 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const visitor = visitorIdentity(request);
  const sessionId = (await context.params).sessionId;
  try {
    await assertSessionOwner(visitor.id, sessionId);
    await agentosAdminRequest(`/sessions/${encodeURIComponent(sessionId)}?user_id=${encodeURIComponent(visitor.id)}`, { method: "DELETE" });
    await consoleChatRequest(`/api/internal/chat/sessions/${encodeURIComponent(sessionId)}?visitorId=${encodeURIComponent(visitor.id)}`, { method: "DELETE" });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "会话删除失败" }, { status: 404 });
  }
}
