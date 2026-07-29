import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { demoProducts } from "@/db/schema";
import { audit } from "@/lib/audit";
import { readSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { serializeProduct } from "@/lib/serializers";

const productSchema = z.object({
  id: z.coerce.number().int().positive().optional(), sku: z.string().trim().min(1).max(64), name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(5000), priceCents: z.coerce.number().int().min(0), stock: z.coerce.number().int().min(0),
  status: z.enum(["ON_SALE", "DRAFT", "OFF_SHELF"]), imageUrl: z.string().trim().url().max(600).or(z.literal("")).optional(),
});

async function authorized() { return readSession(); }
async function items() { return (await db.select().from(demoProducts).orderBy(desc(demoProducts.updatedAt))).map(serializeProduct); }

export async function GET() {
  if (!await authorized()) return NextResponse.json({ message: "未登录" }, { status: 401 });
  return NextResponse.json({ items: await items() });
}

export async function POST(request: Request) {
  const user = await authorized();
  if (!user) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "请检查商品字段", issues: parsed.error.issues }, { status: 400 });
  const value = parsed.data;
  const [result] = await db.insert(demoProducts).values({ ...value, imageUrl: value.imageUrl || null });
  await audit(user, { action: "CREATE", resourceType: "demo_product", resourceId: String(result.insertId), detail: { sku: value.sku } });
  return NextResponse.json({ items: await items() }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await authorized();
  if (!user) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.id) return NextResponse.json({ message: "请检查商品字段和 ID" }, { status: 400 });
  const { id, ...value } = parsed.data;
  await db.update(demoProducts).set({ ...value, imageUrl: value.imageUrl || null }).where(eq(demoProducts.id, id));
  await audit(user, { action: "UPDATE", resourceType: "demo_product", resourceId: String(id), detail: { sku: value.sku } });
  return NextResponse.json({ items: await items() });
}

export async function DELETE(request: Request) {
  const user = await authorized();
  if (!user) return NextResponse.json({ message: "未登录" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ message: "无效 ID" }, { status: 400 });
  await db.update(demoProducts).set({ status: "OFF_SHELF" }).where(eq(demoProducts.id, id));
  await audit(user, { action: "OFF_SHELF", resourceType: "demo_product", resourceId: String(id) });
  return NextResponse.json({ items: await items() });
}
