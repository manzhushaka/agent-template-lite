import { pool } from "../src/lib/db";
import { agentosRequest } from "../src/lib/agentos";
import { processNextKnowledgeIndexJob, recoverStaleKnowledgeIndexJobs } from "../src/lib/knowledge-service";

let stopping = false;
const once = process.argv.includes("--once");
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main() {
  const recovered = await recoverStaleKnowledgeIndexJobs();
  if (recovered) console.warn(`Recovered ${recovered} stale knowledge index jobs.`);
  console.log("Knowledge index worker started.");
  while (!stopping) {
    try {
      await agentosRequest("/api/health");
      const processed = await processNextKnowledgeIndexJob();
      if (processed) console.log(`Knowledge index job ${processed.jobId} completed.`);
      if (once) stopping = true;
      else if (!processed) await delay(2_000);
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Knowledge index worker failed.");
      await delay(5_000);
    }
  }
}

main().finally(async () => {
  await pool.end();
  console.log("Knowledge index worker stopped.");
});
