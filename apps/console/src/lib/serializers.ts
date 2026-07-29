import type { DemoOrder, DemoProduct } from "@template/shared";
import type { demoOrders, demoProducts } from "@/db/schema";

type ProductRow = typeof demoProducts.$inferSelect;
type OrderRow = typeof demoOrders.$inferSelect & { productName: string };

export function serializeProduct(row: ProductRow): DemoProduct {
  return { id: row.id, sku: row.sku, name: row.name, description: row.description, priceCents: row.priceCents, stock: row.stock, status: row.status, imageUrl: row.imageUrl, updatedAt: row.updatedAt.toISOString() };
}

export function serializeOrder(row: OrderRow): DemoOrder {
  return { id: row.id, orderNo: row.orderNo, sessionId: row.sessionId, productId: row.productId, productName: row.productName, quantity: row.quantity, amountCents: row.amountCents, status: row.status, createdAt: row.createdAt.toISOString() };
}
