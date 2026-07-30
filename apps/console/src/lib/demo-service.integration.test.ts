import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe.runIf(process.env.RUN_DB_INTEGRATION === "true")("demo order transaction", () => {
  let runtime: Awaited<typeof import("./demo-service")>;
  let database: Awaited<typeof import("./db")>;
  let schema: Awaited<typeof import("@/db/schema")>;

  beforeAll(async () => {
    runtime = await import("./demo-service");
    database = await import("./db");
    schema = await import("@/db/schema");
    await database.db.delete(schema.demoOrders);
    await database.db.delete(schema.demoOrderQuotes);
    await database.db.delete(schema.auditLogs);
    await database.db.delete(schema.demoProducts);
    await database.db.insert(schema.demoProducts).values({
      sku: "INTEGRATION-001",
      name: "集成测试商品",
      description: "验证库存、订单、幂等和审计位于同一业务事务。",
      priceCents: 1234,
      stock: 2,
      status: "ON_SALE",
    });
  });

  afterAll(async () => database?.pool.end());

  it("creates one order, deducts stock once and records both audit outcomes", async () => {
    const quote = await runtime.prepareOrder("integration-session", "INTEGRATION-001", 1);
    const first = await runtime.confirmOrder("integration-session", quote.quoteId, "integration-idempotency");
    const repeated = await runtime.confirmOrder("integration-session", quote.quoteId, "integration-idempotency");
    const [product] = await database.db.select().from(schema.demoProducts);
    const orders = await database.db.select().from(schema.demoOrders);
    const audits = await database.db.select().from(schema.auditLogs);

    expect(first.idempotent).toBe(false);
    expect(repeated.idempotent).toBe(true);
    expect(product.stock).toBe(1);
    expect(orders).toHaveLength(1);
    expect(audits.map((entry) => entry.action)).toEqual(expect.arrayContaining(["ORDER_CREATE", "ORDER_IDEMPOTENT_RETURN"]));
  });
});
