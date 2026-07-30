import { NextResponse } from "next/server";
import { z } from "zod";
import { internalAuthorized } from "@/lib/auth";
import { createChatSession, listChatSessions } from "@/lib/chat-session-service";

const visitorSchema = z.string().uuid();

export async function GET(request: Request) {
  if (!internalAuthorized(request)) return NextResponse.json({ message: "forbidden" }, { status: 403 });
  const visitor = visitorSchema.safeParse(new URL(request.url).searchParams.get("visitorId"));
  if (!visitor.success) return NextResponse.json({ message: "访客标识无效" }, { status: 400 });
  return NextResponse.json({ items: await listChatSessions(visitor.data) });
}

export async function POST(request: Request) {
  if (!internalAuthorized(request)) return NextResponse.json({ message: "forbidden" }, { status: 403 });
  const parsed = z.object({ visitorId: visitorSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "访客标识无效" }, { status: 400 });
  return NextResponse.json(await createChatSession(parsed.data.visitorId), { status: 201 });
}
