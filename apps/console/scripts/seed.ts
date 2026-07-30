import { hash } from "bcryptjs";
import { and, eq } from "drizzle-orm";
import {
  consoleUsers,
  demoProducts,
  knowledgeDocuments,
  knowledgeDocumentVersions,
} from "../src/db/schema";
import { db, pool } from "../src/lib/db";

const products = [
  { sku: "GIFT-TEA-001", name: "山野茶礼盒", description: "适合商务赠礼的清香型茶礼，包装克制，支持现场自提。", priceCents: 16800, stock: 30, status: "ON_SALE" as const, imageUrl: "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&w=900&q=82" },
  { sku: "CRAFT-CUP-002", name: "手作陶瓷杯", description: "小批量手作杯，适合作为日常纪念品或轻量伴手礼。", priceCents: 8800, stock: 18, status: "ON_SALE" as const, imageUrl: "https://images.unsplash.com/photo-1577937927133-66ef06acdf18?auto=format&fit=crop&w=900&q=82" },
  { sku: "SERVICE-BOX-003", name: "企业体验套装", description: "用于演示咨询、推荐、确认和订单闭环的组合型业务商品。", priceCents: 29900, stock: 12, status: "ON_SALE" as const, imageUrl: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=900&q=82" },
];

async function main() {
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!initialPassword) throw new Error("ADMIN_INITIAL_PASSWORD 未配置");

  const passwordHash = await hash(initialPassword, 12);
  await db.insert(consoleUsers).values({ username: "admin", displayName: "演示管理员", passwordHash, role: "ADMIN" })
    .onDuplicateKeyUpdate({ set: { displayName: "演示管理员", passwordHash, status: "ACTIVE" } });

  for (const product of products) {
    await db.insert(demoProducts).values(product).onDuplicateKeyUpdate({ set: { ...product } });
  }

  await db.transaction(async (tx) => {
    let [knowledge] = await tx.select().from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.title, "演示业务服务说明"))
      .limit(1);

    if (!knowledge) {
      const [inserted] = await tx.insert(knowledgeDocuments).values({
        title: "演示业务服务说明", category: "业务规则", source: "模板种子数据", status: "PUBLISHED", indexStatus: "PENDING",
        content: "演示中心中的商品用于展示智能推荐和受控下单。商品价格与库存必须以系统实时查询为准。准备报价不会创建订单或扣减库存；只有用户在 Chat 的人工确认面板明确同意后，系统才创建演示订单。演示订单不代表已经支付、发货或履约。",
      }).$returningId();
      [knowledge] = await tx.select().from(knowledgeDocuments)
        .where(eq(knowledgeDocuments.id, inserted.id))
        .limit(1);
    }

    if (!knowledge) throw new Error("种子知识写入失败");
    const [snapshot] = await tx.select({ id: knowledgeDocumentVersions.id })
      .from(knowledgeDocumentVersions)
      .where(and(
        eq(knowledgeDocumentVersions.documentId, knowledge.id),
        eq(knowledgeDocumentVersions.version, knowledge.version),
      ))
      .limit(1);
    if (!snapshot) {
      await tx.insert(knowledgeDocumentVersions).values({
        documentId: knowledge.id,
        version: knowledge.version,
        title: knowledge.title,
        category: knowledge.category,
        content: knowledge.content,
        source: knowledge.source,
        sourceType: knowledge.sourceType,
        sourceUri: knowledge.sourceUri,
        sourceHash: knowledge.sourceHash,
        mimeType: knowledge.mimeType,
        fileName: knowledge.fileName,
        fileSize: knowledge.fileSize,
        status: knowledge.status,
        createdBy: "seed",
      });
    }
  });

  await pool.end();
  console.log("Seed completed. Console user: admin");
}

main().catch(async (error: unknown) => {
  await pool.end();
  console.error(error instanceof Error ? error.message : "Database seed failed.");
  process.exitCode = 1;
});
