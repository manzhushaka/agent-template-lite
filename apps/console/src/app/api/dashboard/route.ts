import { count, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auditLogs, demoOrders, demoProducts, knowledgeDocuments } from "@/db/schema";
import { readSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  paginationInput,
  paginationMeta,
  paginationOffset,
  paginationSchema,
} from "@/lib/pagination";

export async function GET(request: Request) {
  if (!await readSession()) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const pagination = paginationSchema.safeParse(
    paginationInput(new URL(request.url).searchParams),
  );
  if (!pagination.success) {
    return NextResponse.json({ message: "分页参数无效" }, { status: 400 });
  }
  const [[products], [orders], [knowledge], [auditTotal], recentItems] = await Promise.all([
    db.select({ value: count() }).from(demoProducts), db.select({ value: count() }).from(demoOrders),
    db.select({ value: count() }).from(knowledgeDocuments),
    db.select({ value: count() }).from(auditLogs),
    db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(pagination.data.pageSize)
      .offset(paginationOffset(pagination.data)),
  ]);
  const total = Number(auditTotal.value);
  return NextResponse.json({
    metrics: {
      products: Number(products.value),
      orders: Number(orders.value),
      knowledge: Number(knowledge.value),
    },
    recent: {
      items: recentItems,
      pagination: paginationMeta(pagination.data, total),
    },
  });
}
