import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applicationLogLevels,
  applicationLogSources,
  readApplicationLogs,
} from "@/lib/application-logs";
import { readSession } from "@/lib/auth";

const querySchema = z.object({
  level: z.enum(applicationLogLevels).optional(),
  source: z.enum(applicationLogSources).optional(),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(50).max(500).default(300),
});

export async function GET(request: Request) {
  if (!await readSession()) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    level: url.searchParams.get("level") || undefined,
    source: url.searchParams.get("source") || undefined,
    q: url.searchParams.get("q") || undefined,
    limit: url.searchParams.get("limit") || undefined,
  });
  if (!parsed.success) return NextResponse.json({ message: "日志查询参数无效" }, { status: 400 });

  try {
    return NextResponse.json(await readApplicationLogs({
      level: parsed.data.level,
      source: parsed.data.source,
      query: parsed.data.q,
      limit: parsed.data.limit,
    }), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { message: "应用日志读取失败" },
      { status: 500 },
    );
  }
}
