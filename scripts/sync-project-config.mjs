import { readFile } from "node:fs/promises";
import path from "node:path";
import { ROOT, readProjectConfig, syncGeneratedProjectFiles } from "./project-config.mjs";

const check = process.argv.includes("--check");
const config = await readProjectConfig();
const changed = await syncGeneratedProjectFiles(ROOT, config, check);

const versionFiles = ["package.json", "apps/chat/package.json", "apps/console/package.json", "packages/shared/package.json"];
for (const relative of versionFiles) {
  const manifest = JSON.parse(await readFile(path.join(ROOT, relative), "utf8"));
  if (manifest.version !== config.templateVersion) changed.push(`${relative}#version`);
}
const pyproject = await readFile(path.join(ROOT, "services/agentos/pyproject.toml"), "utf8");
if (!pyproject.includes(`version = "${config.templateVersion}"`)) changed.push("services/agentos/pyproject.toml#version");

if (changed.length) {
  if (check) {
    console.error(`Project config is out of sync:\n${changed.map((item) => `- ${item}`).join("\n")}`);
    process.exit(1);
  }
  console.log(`Synchronized project config:\n${changed.map((item) => `- ${item}`).join("\n")}`);
} else {
  console.log("Project config is synchronized.");
}
