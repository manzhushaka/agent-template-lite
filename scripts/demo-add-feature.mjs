import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT, readProjectConfig } from "./project-config.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const name = option("--name");
const type = option("--type");
if (!name || !type || !["query", "action"].includes(type)) {
  console.error("Usage: pnpm demo:add-feature -- --name customer-search --type query|action");
  process.exit(2);
}
if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error("Feature name must be kebab-case ASCII.");
const config = await readProjectConfig();
const directory = path.join(ROOT, "features", name);
await mkdir(path.dirname(directory), { recursive: true });
await mkdir(directory, { recursive: false });

const files = {
  "feature.json": `${JSON.stringify({ schemaVersion: 1, name, type, status: "SCAFFOLDED", agentId: config.agent.id }, null, 2)}\n`,
  "IMPLEMENTATION.md": `# ${name}\n\nThis generated vertical slice is intentionally incomplete until its business rules are confirmed.\n\n- [ ] Add the stable card/result contract in \`packages/shared\`.\n- [ ] Add Drizzle schema, migration, domain service and transaction tests in Console.\n- [ ] Add a token-protected internal API with validated input and output.\n- [ ] Add a typed Python client model and Tool${type === "action" ? " with requires_confirmation=True and an idempotency key" : ""}.\n- [ ] Register a Chat card only when the result needs structured rendering.\n- [ ] Add a golden case to \`evals/cases.json\`.\n- [ ] Set \`feature.json.status\` to \`IMPLEMENTED\` only after E2E verification.\n`,
  "contract.example.json": `${JSON.stringify({ ok: true, code: `${name.replaceAll("-", "_").toUpperCase()}_OK`, message: "Replace with a stable business message", data: {}, cards: [] }, null, 2)}\n`,
};
for (const [file, content] of Object.entries(files)) await writeFile(path.join(directory, file), content, { encoding: "utf8", flag: "wx" });
console.log(`Created feature scaffold: features/${name}`);
console.log("The placeholder check will fail until the vertical slice is implemented and marked IMPLEMENTED.");
