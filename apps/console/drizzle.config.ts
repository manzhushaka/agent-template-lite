import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.MYSQL_URL || "mysql://agent_demo:change-me@127.0.0.1:3306/agent_demo" },
  strict: true,
  verbose: true,
});
