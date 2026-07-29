import { NextResponse } from "next/server";
import { z } from "zod";
import { internalAuthorized } from "@/lib/auth";
import { BusinessError, prepareOrder } from "@/lib/demo-service";

const schema = z.object({ sessionId: z.string().min(1).max(128), sku: z.string().min(1).max(64), quantity: z.number().int().min(1).max(10) });

export async function POST(request: Request) {
  if (!internalAuthorized(request)) return NextResponse.json({ message: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "报价参数错误" }, { status: 400 });
  try { return NextResponse.json(await prepareOrder(parsed.data.sessionId, parsed.data.sku, parsed.data.quantity)); }
  catch (error) { return error instanceof BusinessError ? NextResponse.json({ code: error.code, message: error.message }, { status: error.status }) : NextResponse.json({ code: "INTERNAL_ERROR", message: "报价服务异常" }, { status: 500 }); }
}
