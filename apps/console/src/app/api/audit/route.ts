import { count, desc, like, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auditLogs } from "@/db/schema";
import { readSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { paginationInput, paginationMeta, paginationOffset, paginationSchema } from "@/lib/pagination";

export async function GET(request: Request) {
  if (!await readSession()) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const url = new URL(request.url);
  const pagination = paginationSchema.safeParse(paginationInput(url.searchParams));
  const query = z.string().trim().max(200).safeParse(url.searchParams.get("q") || "");
  if (!pagination.success || !query.success) return NextResponse.json({ message: "查询参数无效" }, { status: 400 });
  const term = query.data;
  const condition = term ? or(like(auditLogs.actor, `%${term}%`), like(auditLogs.action, `%${term}%`), like(auditLogs.resourceType, `%${term}%`), like(auditLogs.resourceId, `%${term}%`)) : undefined;
  const [[totalRow], items] = await Promise.all([
    db.select({ value: count() }).from(auditLogs).where(condition),
    db.select().from(auditLogs).where(condition).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(pagination.data.pageSize).offset(paginationOffset(pagination.data)),
  ]);
  return NextResponse.json({ items, pagination: paginationMeta(pagination.data, Number(totalRow.value)) });
}
