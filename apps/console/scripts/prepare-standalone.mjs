import { cp, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = path.join(appRoot, ".next", "standalone", "apps", "console");
async function copyIfPresent(source, target) {
  try { await access(source); await cp(source, target, { recursive: true, force: true }); } catch { /* optional asset directory */ }
}
await copyIfPresent(path.join(appRoot, "public"), path.join(standaloneRoot, "public"));
await copyIfPresent(path.join(appRoot, ".next", "static"), path.join(standaloneRoot, ".next", "static"));
