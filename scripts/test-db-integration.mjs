import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { ROOT } from "./project-config.mjs";

const requireFromConsole = createRequire(path.join(ROOT, "apps/console/package.json"));
const mysql = requireFromConsole("mysql2/promise");
const source = process.env.MYSQL_URL;
if (!source) throw new Error("MYSQL_URL 未配置");
const url = new URL(source);
const originalDatabase = url.pathname.slice(1);
const targetDatabase = `${originalDatabase}_integration`;
if (!/^[a-z][a-z0-9_]*_integration$/.test(targetDatabase) || targetDatabase === originalDatabase) {
  throw new Error("拒绝使用未验证的集成测试数据库名");
}
const serverUrl = new URL(url);
serverUrl.pathname = "/";
const connection = await mysql.createConnection(serverUrl.toString());
let created = false;
let mockAgentos;

function run(command, args, env) {
  const result = spawnSync(command, args, { cwd: ROOT, env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
}

try {
  await connection.query(`CREATE DATABASE \`${targetDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  created = true;
  const testUrl = new URL(url);
  testUrl.pathname = `/${targetDatabase}`;
  const env = { ...process.env, MYSQL_URL: testUrl.toString(), RUN_DB_INTEGRATION: "true" };
  run("pnpm", ["--filter", "@template/console", "db:migrate"], env);
  run("pnpm", ["--filter", "@template/console", "demo:reset", "--", "--yes"], env);
  mockAgentos = spawn("node", ["tests/e2e/mock-agentos.mjs"], { cwd: ROOT, env, stdio: "ignore" });
  await new Promise((resolve) => setTimeout(resolve, 400));
  run("pnpm", ["--filter", "@template/console", "knowledge:worker", "--", "--once"], {
    ...env,
    AGENTOS_URL: "http://127.0.0.1:18000",
    INTERNAL_API_TOKEN: "integration-internal-token",
  });
  const [jobs] = await connection.query(`SELECT status FROM \`${targetDatabase}\`.knowledge_index_job ORDER BY id DESC LIMIT 1`);
  if (jobs[0]?.status !== "SUCCEEDED") throw new Error("Knowledge worker did not complete the pending job");
  run("pnpm", ["--filter", "@template/console", "test"], env);
} finally {
  mockAgentos?.kill("SIGTERM");
  if (created) await connection.query(`DROP DATABASE \`${targetDatabase}\``);
  await connection.end();
}
