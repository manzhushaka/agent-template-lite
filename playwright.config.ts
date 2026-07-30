import { defineConfig } from "@playwright/test";

const sharedEnv = {
  MYSQL_URL: process.env.MYSQL_URL || "mysql://agent_demo:agent_demo@127.0.0.1:3306/agent_demo",
  AGENT_DATABASE_URL: process.env.AGENT_DATABASE_URL || "mysql+pymysql://agent_demo:agent_demo@127.0.0.1:3306/agent_demo",
  AUTH_SECRET: process.env.AUTH_SECRET || "e2e-auth-secret-at-least-32-characters",
  CHAT_VISITOR_SECRET: process.env.CHAT_VISITOR_SECRET || "e2e-visitor-secret-at-least-32-characters",
  INTERNAL_API_TOKEN: process.env.INTERNAL_API_TOKEN || "e2e-internal-token-at-least-32-characters",
  ADMIN_INITIAL_PASSWORD: process.env.ADMIN_INITIAL_PASSWORD || "e2e-admin-password",
  MODEL_NAME: "e2e-model",
  MODEL_BASE_URL: "http://127.0.0.1:18000/v1",
  MODEL_API_KEY: "e2e-model-key",
  AGENTOS_BASE_URL: "http://127.0.0.1:18000",
  AGENTOS_URL: "http://127.0.0.1:18000",
  CONSOLE_URL: "http://127.0.0.1:13001",
  CHAT_PORT: "13000",
  CONSOLE_PORT: "13001",
};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:13000", trace: "retain-on-failure" },
  webServer: [
    { command: "node tests/e2e/mock-agentos.mjs", port: 18000, reuseExistingServer: false, env: sharedEnv },
    { command: "pnpm --filter @template/console dev", port: 13001, reuseExistingServer: false, env: sharedEnv },
    { command: "pnpm --filter @template/chat dev", port: 13000, reuseExistingServer: false, env: sharedEnv },
  ],
  projects: [
    { name: "desktop-1440", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
    { name: "tablet-991", use: { browserName: "chromium", viewport: { width: 991, height: 820 } } },
    { name: "mobile-390", use: { browserName: "chromium", viewport: { width: 390, height: 844 } } },
  ],
});
