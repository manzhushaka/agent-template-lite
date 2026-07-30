import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { ROOT, readProjectConfig, syncGeneratedProjectFiles } from "./project-config.mjs";

const live = process.argv.includes("--live");
const checks = [];
const add = (status, name, detail) => checks.push({ status, name, detail });

function parseEnv(source) {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function command(name) {
  const result = spawnSync(name, ["--version"], { encoding: "utf8" });
  add(result.status === 0 ? "PASS" : "FAIL", name, result.status === 0 ? (result.stdout || result.stderr).trim().split("\n")[0] : "not available");
}

async function tcp(urlValue, name) {
  try {
    const url = new URL(urlValue.replace("mysql+pymysql://", "mysql://"));
    const port = Number(url.port || (url.protocol.startsWith("mysql") ? 3306 : 80));
    await new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: url.hostname, port });
      socket.setTimeout(2500);
      socket.once("connect", () => { socket.destroy(); resolve(); });
      socket.once("timeout", () => { socket.destroy(); reject(new Error("timeout")); });
      socket.once("error", reject);
    });
    add("PASS", name, `${url.hostname}:${port}`);
  } catch (error) {
    add("FAIL", name, error instanceof Error ? error.message : "unreachable");
  }
}

async function http(url, name, headers = {}) {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    add(response.ok ? "PASS" : "FAIL", name, `HTTP ${response.status}`);
  } catch (error) {
    add("FAIL", name, error instanceof Error ? error.message : "unreachable");
  }
}

const config = await readProjectConfig();
command("node");
command("pnpm");
command("uv");
const generated = await syncGeneratedProjectFiles(ROOT, config, true);
add(generated.length ? "FAIL" : "PASS", "project config", generated.length ? generated.join(", ") : "generated files synchronized");

const envSource = await readFile(path.join(ROOT, ".env"), "utf8").catch(() => "");
if (!envSource) {
  add("FAIL", ".env", "missing; run pnpm setup");
} else {
  const env = parseEnv(envSource);
  const required = ["MYSQL_URL", "AGENT_DATABASE_URL", "AUTH_SECRET", "CHAT_VISITOR_SECRET", "INTERNAL_API_TOKEN", "ADMIN_INITIAL_PASSWORD", "MODEL_NAME", "MODEL_BASE_URL", "MODEL_API_KEY"];
  const missing = required.filter((name) => !env[name] || /^(?:change-me|replace-with)/.test(env[name]));
  add(missing.length ? "FAIL" : "PASS", "environment", missing.length ? `missing or placeholder: ${missing.join(", ")}` : "required values present");
  if (live && !missing.length) {
    await tcp(env.MYSQL_URL, "MySQL TCP");
    const chatPort = env.CHAT_PORT || config.defaultPorts.chat;
    const consolePort = env.CONSOLE_PORT || config.defaultPorts.console;
    const agentosPort = env.AGENTOS_PORT || config.defaultPorts.agentos;
    await http(`http://127.0.0.1:${chatPort}`, "Chat health");
    await http(`http://127.0.0.1:${consolePort}/api/health`, "Console health");
    await http(`http://127.0.0.1:${agentosPort}/api/health`, "AgentOS health");
    await http(`${env.MODEL_BASE_URL.replace(/\/$/, "")}/models`, "Model API", { authorization: `Bearer ${env.MODEL_API_KEY}` });
  }
}

for (const check of checks) console.log(`${check.status.padEnd(4)} ${check.name}: ${check.detail}`);
const failures = checks.filter((check) => check.status === "FAIL").length;
console.log(`${checks.length - failures}/${checks.length} checks passed${live ? " with live connectivity" : " (use --live for connectivity)"}.`);
if (failures) process.exit(1);
