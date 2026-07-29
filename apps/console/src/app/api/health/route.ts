import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return Response.json({ status: "ok", service: "console", database: "connected" });
  } catch {
    return Response.json({ status: "degraded", service: "console", database: "unavailable" }, { status: 503 });
  }
}
