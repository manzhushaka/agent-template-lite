import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const config = JSON.parse(await readFile(path.join(root, "template.config.json"), "utf8"));
if (config.projectSlug === "agent-template-lite") {
  console.log("Template source mode: placeholder check skipped until the builder creates a project.");
  process.exit(0);
}

const forbidden = ["agent-template-lite", "@template/", "business-demo-agent", "智能业务助手"];
const ignored = new Set(["node_modules", ".git", ".next", ".venv", "skills"]);
const findings = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target);
    else if (/\.(?:ts|tsx|js|mjs|json|md|py|toml|ya?ml|service|conf)$/.test(entry.name)) {
      const content = await readFile(target, "utf8").catch(() => "");
      for (const value of forbidden) if (content.includes(value)) findings.push(`${path.relative(root, target)}: ${value}`);
    }
  }
}
await walk(root);
if (findings.length) {
  console.error("Generated project still contains template placeholders:\n" + findings.join("\n"));
  process.exit(1);
}
console.log("No template placeholders found.");
