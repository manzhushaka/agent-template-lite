import { hash } from "bcryptjs";
import { and, eq } from "drizzle-orm";
import {
  consoleUsers,
  demoProducts,
  knowledgeDocuments,
  knowledgeDocumentVersions,
  knowledgeIndexJobs,
} from "../src/db/schema";
import { db, pool } from "../src/lib/db";
import fixtures from "../../../fixtures/demo.json";

const products = fixtures.products.map((product) => ({ ...product, status: product.status as "ON_SALE" }));

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
      .where(eq(knowledgeDocuments.title, fixtures.knowledge.title))
      .limit(1);

    if (!knowledge) {
      const [inserted] = await tx.insert(knowledgeDocuments).values({
        ...fixtures.knowledge,
        status: "PUBLISHED",
        indexStatus: "PENDING",
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
    const [indexJob] = await tx.select({ id: knowledgeIndexJobs.id })
      .from(knowledgeIndexJobs)
      .where(eq(knowledgeIndexJobs.documentId, knowledge.id))
      .limit(1);
    if (!indexJob) {
      await tx.insert(knowledgeIndexJobs).values({
        documentId: knowledge.id,
        targetVersion: knowledge.version,
        requestedBy: "seed",
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
