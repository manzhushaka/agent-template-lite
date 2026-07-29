import { count, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auditLogs, demoOrders, demoProducts, knowledgeDocuments } from "@/db/schema";
import { readSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  if (!await readSession()) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const [[products], [orders], [knowledge], recent] = await Promise.all([
    db.select({ value: count() }).from(demoProducts), db.select({ value: count() }).from(demoOrders),
    db.select({ value: count() }).from(knowledgeDocuments), db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(8),
  ]);
  return NextResponse.json({ metrics: { products: products.value, orders: orders.value, knowledge: knowledge.value }, recent });
}
