import { randomUUID } from "node:crypto";
import { and, count, desc, eq, like, or, sql } from "drizzle-orm";
import { auditLogs, demoOrderQuotes, demoOrders, demoProducts } from "@/db/schema";
import { db } from "./db";
import {
  PaginatedResult,
  PaginationQuery,
  paginationMeta,
  paginationOffset,
} from "./pagination";
import { serializeOrder, serializeProduct } from "./serializers";

export class BusinessError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
  }
}

export async function listProducts(query = "") {
  const term = query.trim();
  const condition = term
    ? and(eq(demoProducts.status, "ON_SALE"), or(like(demoProducts.name, `%${term}%`), like(demoProducts.description, `%${term}%`), like(demoProducts.sku, `%${term}%`)))
    : eq(demoProducts.status, "ON_SALE");
  return (await db.select().from(demoProducts).where(condition).orderBy(desc(demoProducts.updatedAt))).map(serializeProduct);
}

export async function listConsoleProducts(
  query: string,
  pagination: PaginationQuery,
): Promise<PaginatedResult<ReturnType<typeof serializeProduct>>> {
  const term = query.trim();
  const condition = term
    ? or(
        like(demoProducts.sku, `%${term}%`),
        like(demoProducts.name, `%${term}%`),
        like(demoProducts.description, `%${term}%`),
      )
    : undefined;
  const [[totalRow], rows] = await Promise.all([
    db.select({ value: count() }).from(demoProducts).where(condition),
    db
      .select()
      .from(demoProducts)
      .where(condition)
      .orderBy(desc(demoProducts.updatedAt), desc(demoProducts.id))
      .limit(pagination.pageSize)
      .offset(paginationOffset(pagination)),
  ]);
  const total = Number(totalRow.value);
  return {
    items: rows.map(serializeProduct),
    pagination: paginationMeta(pagination, total),
  };
}

export async function prepareOrder(sessionId: string, sku: string, quantity: number) {
  if (!sessionId.trim()) throw new BusinessError("INVALID_SESSION", "会话标识不能为空");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new BusinessError("INVALID_QUANTITY", "数量必须在 1 到 10 之间");
  const [product] = await db.select().from(demoProducts).where(and(eq(demoProducts.sku, sku), eq(demoProducts.status, "ON_SALE"))).limit(1);
  if (!product) throw new BusinessError("PRODUCT_NOT_FOUND", "商品不存在或已下架", 404);
  if (product.stock < quantity) throw new BusinessError("INSUFFICIENT_STOCK", "商品库存不足", 409);
  const quoteId = `Q-${randomUUID()}`;
  const amountCents = product.priceCents * quantity;
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  await db.insert(demoOrderQuotes).values({ quoteId, sessionId, productId: product.id, quantity, amountCents, expiresAt });
  return { quoteId, sessionId, sku: product.sku, productName: product.name, quantity, amountCents, expiresAt: expiresAt.toISOString() };
}

/**
 * Confirming an order is idempotent and locks inventory in one transaction.
 * EXTENSION: Real payment or fulfilment integrations belong after order persistence; keep the
 * idempotency lookup before any external call and query uncertain downstream outcomes.
 */
export async function confirmOrder(sessionId: string, quoteId: string, idempotencyKey: string) {
  if (!idempotencyKey.trim()) throw new BusinessError("IDEMPOTENCY_REQUIRED", "幂等键不能为空");
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ order: demoOrders, productName: demoProducts.name })
      .from(demoOrders).innerJoin(demoProducts, eq(demoOrders.productId, demoProducts.id))
      .where(eq(demoOrders.idempotencyKey, idempotencyKey)).limit(1);
    if (existing) {
      await tx.insert(auditLogs).values({
        actor: "internal-agent",
        action: "ORDER_IDEMPOTENT_RETURN",
        resourceType: "demo_order",
        resourceId: existing.order.orderNo,
        detail: { sessionId },
      });
      return { order: serializeOrder({ ...existing.order, productName: existing.productName }), idempotent: true };
    }

    const [quote] = await tx.select().from(demoOrderQuotes).where(eq(demoOrderQuotes.quoteId, quoteId)).limit(1);
    if (!quote || quote.sessionId !== sessionId) throw new BusinessError("QUOTE_NOT_FOUND", "报价不存在或不属于当前会话", 404);
    if (quote.status !== "PREPARED") throw new BusinessError("QUOTE_USED", "报价已经处理", 409);
    if (quote.expiresAt.getTime() <= Date.now()) {
      await tx.update(demoOrderQuotes).set({ status: "EXPIRED" }).where(eq(demoOrderQuotes.id, quote.id));
      throw new BusinessError("QUOTE_EXPIRED", "报价已经过期，请重新选择商品", 409);
    }

    // MySQL row lock prevents two confirmations from consuming the same last unit of stock.
    await tx.execute(sql`SELECT id FROM demo_product WHERE id = ${quote.productId} FOR UPDATE`);
    const [product] = await tx.select().from(demoProducts).where(eq(demoProducts.id, quote.productId)).limit(1);
    if (!product || product.status !== "ON_SALE") throw new BusinessError("PRODUCT_UNAVAILABLE", "商品当前不可下单", 409);
    if (product.stock < quote.quantity) throw new BusinessError("INSUFFICIENT_STOCK", "商品库存不足", 409);

    const orderNo = `D${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
    await tx.update(demoProducts).set({ stock: product.stock - quote.quantity }).where(eq(demoProducts.id, product.id));
    await tx.insert(demoOrders).values({ orderNo, idempotencyKey, sessionId, productId: product.id, quantity: quote.quantity, amountCents: quote.amountCents });
    await tx.update(demoOrderQuotes).set({ status: "CONFIRMED" }).where(eq(demoOrderQuotes.id, quote.id));
    await tx.insert(auditLogs).values({
      actor: "internal-agent",
      action: "ORDER_CREATE",
      resourceType: "demo_order",
      resourceId: orderNo,
      detail: { sessionId },
    });
    const [created] = await tx.select().from(demoOrders).where(eq(demoOrders.orderNo, orderNo)).limit(1);
    return { order: serializeOrder({ ...created, productName: product.name }), idempotent: false };
  });
}

export async function listOrders(
  pagination: PaginationQuery,
): Promise<PaginatedResult<ReturnType<typeof serializeOrder>>> {
  const [[totalRow], rows] = await Promise.all([
    db.select({ value: count() }).from(demoOrders),
    db
      .select({ order: demoOrders, productName: demoProducts.name })
      .from(demoOrders)
      .innerJoin(demoProducts, eq(demoOrders.productId, demoProducts.id))
      .orderBy(desc(demoOrders.createdAt), desc(demoOrders.id))
      .limit(pagination.pageSize)
      .offset(paginationOffset(pagination)),
  ]);
  const total = Number(totalRow.value);
  return {
    items: rows.map((row) => serializeOrder({ ...row.order, productName: row.productName })),
    pagination: paginationMeta(pagination, total),
  };
}
