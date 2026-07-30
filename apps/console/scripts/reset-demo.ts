import fixtures from "../../../fixtures/demo.json";
import {
  auditLogs,
  chatSessions,
  demoOrderQuotes,
  demoOrders,
  demoProducts,
  knowledgeDocuments,
  knowledgeDocumentVersions,
  knowledgeIndexJobs,
} from "../src/db/schema";
import { db, pool } from "../src/lib/db";

if (!process.argv.includes("--yes")) {
  throw new Error("Demo reset deletes local demo data. Re-run with: pnpm demo:reset -- --yes");
}
if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_RESET !== "true") {
  throw new Error("Production demo reset requires ALLOW_DEMO_RESET=true");
}

async function resetAgentRuntimeTables() {
  const knownTables = ["agent_evaluations", "agent_metrics", "agent_memories", "agent_sessions", "agent_knowledge"];
  for (const table of knownTables) {
    try {
      await pool.query(`DELETE FROM \`${table}\``);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code !== "ER_NO_SUCH_TABLE") throw error;
    }
  }
}

async function main() {
  await db.transaction(async (tx) => {
    await tx.delete(demoOrders);
    await tx.delete(demoOrderQuotes);
    await tx.delete(demoProducts);
    await tx.delete(knowledgeIndexJobs);
    await tx.delete(knowledgeDocumentVersions);
    await tx.delete(knowledgeDocuments);
    await tx.delete(chatSessions);
    await tx.delete(auditLogs);

    await tx.insert(demoProducts).values(fixtures.products.map((product) => ({
      ...product,
      status: product.status as "ON_SALE",
    })));
    const [document] = await tx.insert(knowledgeDocuments).values({
      ...fixtures.knowledge,
      status: "PUBLISHED",
      indexStatus: "PENDING",
    }).$returningId();
    await tx.insert(knowledgeDocumentVersions).values({
      documentId: document.id,
      version: 1,
      ...fixtures.knowledge,
      sourceType: "MANUAL",
      status: "PUBLISHED",
      createdBy: "demo-reset",
    });
    await tx.insert(knowledgeIndexJobs).values({ documentId: document.id, targetVersion: 1, requestedBy: "demo-reset" });
  });
  await resetAgentRuntimeTables();
  console.log("Demo data reset. Run the knowledge worker or reindex from Console before presenting.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Demo reset failed.");
  process.exitCode = 1;
}).finally(() => pool.end());
