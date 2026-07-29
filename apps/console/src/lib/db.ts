import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "@/db/schema";

// Keep production configuration explicit, but allow `next build` to run before `.env` exists.
// Route handlers will report a database health failure until setup.sh creates a real .env.
const mysqlUrl = process.env.MYSQL_URL || "mysql://agent_demo:change-me@127.0.0.1:3306/agent_demo";

/** One shared pool is safe across Next.js route handlers and avoids reconnecting per request. */
export const pool = mysql.createPool({ uri: mysqlUrl, connectionLimit: 10, enableKeepAlive: true });
export const db = drizzle({ client: pool, schema, mode: "default" });
