import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import {
  ROOT,
  readProjectConfig,
  renameProjectPaths,
  syncGeneratedProjectFiles,
  textFiles,
  validateProjectConfig,
} from "./project-config.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const configPath = option("--config");
const dryRun = process.argv.includes("--dry-run");
if (!configPath) {
  console.error("Usage: pnpm demo:init -- --config business.yaml [--dry-run]");
  process.exit(2);
}

const current = await readProjectConfig();
const source = await readFile(path.resolve(configPath), "utf8");
const input = configPath.endsWith(".json") ? JSON.parse(source) : YAML.parse(source);
const next = validateProjectConfig({
  ...current,
  ...input,
  mode: "generated",
  agent: { ...current.agent, ...input.agent },
  database: { ...current.database, ...input.database },
  defaultPorts: { ...current.defaultPorts, ...input.defaultPorts },
  capabilities: input.capabilities || current.capabilities,
});

const replacements = [
  [current.projectNameEn, next.projectNameEn],
  [current.projectName, next.projectName],
  [current.agent.name, next.agent.name],
  [current.agent.id, next.agent.id],
  [`${current.packageScope}/`, `${next.packageScope}/`],
  [current.database.name, next.database.name],
  [current.cookiePrefix, next.cookiePrefix],
  [current.projectSlug, next.projectSlug],
].filter(([from, to]) => from !== to).sort((a, b) => b[0].length - a[0].length);

const portFiles = new Set([
  ".env.example",
  "AGENTS.md",
  "README.md",
  "apps/chat/package.json",
  "apps/console/package.json",
  "scripts/run-services.sh",
  "scripts/start.sh",
  "scripts/status.sh",
  "services/agentos/app/config.py",
]);
const changes = [];
for (const target of await textFiles()) {
  const relative = path.relative(ROOT, target);
  if (relative === "template.config.json" || relative === "scripts/check-placeholders.mjs" || relative.startsWith("skills/")) continue;
  let content = await readFile(target, "utf8");
  const original = content;
  for (const [from, to] of replacements) content = content.replaceAll(from, to);
  if (portFiles.has(relative) || relative.startsWith("deploy/")) {
    for (const runtime of ["chat", "console", "agentos"]) {
      content = content.replaceAll(String(current.defaultPorts[runtime]), String(next.defaultPorts[runtime]));
    }
  }
  if (content !== original) {
    changes.push(relative);
    if (!dryRun) await writeFile(target, content, "utf8");
  }
}

if (!dryRun) {
  await writeFile(path.join(ROOT, "template.config.json"), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await syncGeneratedProjectFiles(ROOT, next);
  await renameProjectPaths(ROOT, current.projectSlug, next.projectSlug);
}
console.log(`${dryRun ? "Would update" : "Updated"} ${changes.length} files for ${next.projectName} (${next.projectSlug}).`);
console.log("Run pnpm config:check && pnpm check:placeholders before business implementation.");
