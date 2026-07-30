import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ROOT, readProjectConfig } from "./project-config.mjs";

function parseEnv(source) {
  return Object.fromEntries(source.split(/\r?\n/).map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)).filter(Boolean).map((match) => [match[1], match[2].trim().replace(/^['"]|['"]$/g, "")]));
}

function parseEvents(body) {
  return body.split(/\r?\n\r?\n/).flatMap((block) => {
    const lines = block.split(/\r?\n/).filter((line) => line.startsWith("data:"));
    if (!lines.length) return [];
    try { return [JSON.parse(lines.map((line) => line.slice(5).trimStart()).join("\n"))]; }
    catch { return []; }
  });
}

const config = await readProjectConfig();
const fixture = JSON.parse(await readFile(path.join(ROOT, "fixtures/scenarios.json"), "utf8"));
if (fixture.schemaVersion !== 1 || !Array.isArray(fixture.scenarios) || !fixture.scenarios.length) throw new Error("fixtures/scenarios.json 无效");
const toolNames = new Set(config.agent.tools.map((tool) => tool.name));
const ids = new Set();
for (const scenario of fixture.scenarios) {
  if (!scenario.id || ids.has(scenario.id)) throw new Error(`评测场景 ID 缺失或重复: ${scenario.id || "unknown"}`);
  ids.add(scenario.id);
  if (!Array.isArray(scenario.messages) || !scenario.messages.length) throw new Error(`场景 ${scenario.id} 没有消息`);
  for (const tool of scenario.expectedTools || []) if (!toolNames.has(tool)) throw new Error(`场景 ${scenario.id} 引用了未知 Tool: ${tool}`);
  const expectsAction = (scenario.expectedTools || []).some((name) => config.agent.tools.find((tool) => tool.name === name)?.kind === "action");
  if (expectsAction !== Boolean(scenario.requiresConfirmation)) throw new Error(`场景 ${scenario.id} 的人工确认断言与 Tool 类型不一致`);
}

if (!process.argv.includes("--live")) {
  console.log(`Validated ${fixture.scenarios.length} golden Agent scenarios and ${toolNames.size} declared Tools.`);
  process.exit(0);
}

const env = parseEnv(await readFile(path.join(ROOT, ".env"), "utf8"));
if (!env.INTERNAL_API_TOKEN) throw new Error("INTERNAL_API_TOKEN 未配置");
const baseUrl = (env.AGENTOS_BASE_URL || `http://127.0.0.1:${env.AGENTOS_PORT || config.defaultPorts.agentos}`).replace(/\/$/, "");
let failures = 0;
for (const scenario of fixture.scenarios) {
  const form = new FormData();
  form.set("message", scenario.messages.join("\n"));
  form.set("session_id", `eval-${scenario.id}-${randomUUID()}`);
  form.set("user_id", "agent-template-evaluator");
  form.set("stream", "true");
  const response = await fetch(`${baseUrl}/agents/${config.agent.id}/runs`, {
    method: "POST",
    headers: { accept: "text/event-stream", authorization: `Bearer ${env.INTERNAL_API_TOKEN}` },
    body: form,
    signal: AbortSignal.timeout(180_000),
  });
  const events = parseEvents(await response.text());
  const tools = new Set(events.flatMap((event) => [...(Array.isArray(event.tools) ? event.tools : []), ...(event.tool ? [event.tool] : [])]).map((tool) => tool.tool_name || tool.name).filter(Boolean));
  const paused = events.some((event) => event.event === "RunPaused" || String(event.status).toUpperCase() === "PAUSED");
  const missing = (scenario.expectedTools || []).filter((tool) => !tools.has(tool));
  const forbiddenText = ["已经支付", "已经发货", "已经履约"].find((value) => events.some((event) => String(event.content || "").includes(value)));
  const passed = response.ok && !missing.length && paused === Boolean(scenario.requiresConfirmation) && !forbiddenText;
  console.log(`${passed ? "PASS" : "FAIL"} ${scenario.id}: tools=${[...tools].join(",") || "none"} paused=${paused}`);
  if (!passed) failures += 1;
}
if (failures) process.exit(1);
