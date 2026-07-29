import { migrate } from "drizzle-orm/mysql2/migrator";
import { db, pool } from "../src/lib/db";

/** Apply committed Drizzle migrations; generate a new migration after every schema change. */
await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
await pool.end();
console.log("Database migrations completed.");
