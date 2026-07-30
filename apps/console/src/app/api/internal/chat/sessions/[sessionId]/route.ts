import { NextResponse } from "next/server";
import { z } from "zod";
import { internalAuthorized } from "@/lib/auth";
import { deleteChatSession, ownsChatSession, renameChatSession, touchChatSession } from "@/lib/chat-session-service";

type Context = { params: Promise<{ sessionId: string }> };
const visitorSchema = z.string().uuid();

export async function GET(request: Request, context: Context) {
  if (!internalAuthorized(request)) return NextResponse.json({ message: "forbidden" }, { status: 403 });
  const visitor = visitorSchema.safeParse(new URL(request.url).searchParams.get("visitorId"));
  const sessionId = (await context.params).sessionId;
  if (!visitor.success || !await ownsChatSession(visitor.data, sessionId)) return NextResponse.json({ message: "会话不存在" }, { status: 404 });
  return NextResponse.json({ owned: true });
}

export async function PATCH(request: Request, context: Context) {
  if (!internalAuthorized(request)) return NextResponse.json({ message: "forbidden" }, { status: 403 });
  const parsed = z.object({ visitorId: visitorSchema, title: z.string().trim().min(1).max(120).optional(), touch: z.boolean().optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "会话参数无效" }, { status: 400 });
  const sessionId = (await context.params).sessionId;
  const updated = parsed.data.title
    ? await renameChatSession(parsed.data.visitorId, sessionId, parsed.data.title)
    : await touchChatSession(parsed.data.visitorId, sessionId);
  return updated ? NextResponse.json({ ok: true }) : NextResponse.json({ message: "会话不存在" }, { status: 404 });
}

export async function DELETE(request: Request, context: Context) {
  if (!internalAuthorized(request)) return NextResponse.json({ message: "forbidden" }, { status: 403 });
  const visitor = visitorSchema.safeParse(new URL(request.url).searchParams.get("visitorId"));
  const sessionId = (await context.params).sessionId;
  if (!visitor.success || !await deleteChatSession(visitor.data, sessionId)) return NextResponse.json({ message: "会话不存在" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
