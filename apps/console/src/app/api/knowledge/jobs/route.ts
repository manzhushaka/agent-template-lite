import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { knowledgeIndexJobs } from "@/db/schema";
import { readSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  if (!await readSession()) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const items = await db.select().from(knowledgeIndexJobs)
    .orderBy(desc(knowledgeIndexJobs.createdAt), desc(knowledgeIndexJobs.id)).limit(20);
  return NextResponse.json({ items });
}
