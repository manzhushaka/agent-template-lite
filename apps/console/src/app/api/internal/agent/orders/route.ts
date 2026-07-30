import { NextResponse } from "next/server";
import { z } from "zod";
import { internalAuthorized } from "@/lib/auth";
import { BusinessError, confirmOrder } from "@/lib/demo-service";

const schema = z.object({ sessionId: z.string().min(1).max(128), quoteId: z.string().min(1).max(64), idempotencyKey: z.string().min(1).max(128) });

export async function POST(request: Request) {
  if (!internalAuthorized(request)) return NextResponse.json({ message: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ code: "INVALID_INPUT", message: "订单参数错误" }, { status: 400 });
  try {
    const result = await confirmOrder(parsed.data.sessionId, parsed.data.quoteId, parsed.data.idempotencyKey);
    return NextResponse.json(result);
  } catch (error) {
    return error instanceof BusinessError ? NextResponse.json({ code: error.code, message: error.message }, { status: error.status }) : NextResponse.json({ code: "INTERNAL_ERROR", message: "订单服务异常" }, { status: 500 });
  }
}
