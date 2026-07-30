import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseApplicationLogLine,
  readApplicationLogs,
  redactApplicationLog,
} from "./application-logs";

describe("application logs", () => {
  it("parses timestamp, runtime and standard levels", () => {
    expect(parseApplicationLogLine("[2026-07-30 14:25:09.123 agentos] WARNING: retry delayed", 4)).toMatchObject({
      level: "WARN",
      source: "agentos",
      message: "WARNING: retry delayed",
    });
    expect(parseApplicationLogLine("[console] Error: database unavailable", 5)).toMatchObject({
      level: "ERROR",
      source: "console",
      timestamp: null,
    });
    expect(parseApplicationLogLine("unprefixed supervisor message", 6)).toMatchObject({
      level: "INFO",
      source: "system",
    });
  });

  it("redacts credentials before returning log messages", () => {
    const redacted = redactApplicationLog(
      "Authorization: Bearer secret-token model_api_key=lowercase-key MYSQL_URL=mysql://demo:password@localhost/db \"apiKey\":\"model-key\" \"cookie\":\"session=value\"",
    );

    expect(redacted).not.toContain("secret-token");
    expect(redacted).not.toContain("password@localhost");
    expect(redacted).not.toContain("model-key");
    expect(redacted).not.toContain("lowercase-key");
    expect(redacted).not.toContain("session=value");
    expect(redacted).toContain("[REDACTED]");
  });

  it("maps debug and fatal output into the supported four-level contract", () => {
    expect(parseApplicationLogLine("[chat] DEBUG request accepted")?.level).toBe("DEBUG");
    expect(parseApplicationLogLine("[chat] FATAL worker stopped")?.level).toBe("ERROR");
  });

  it("filters the bounded tail by level, source and keyword", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "agent-template-logs-"));
    const file = path.join(directory, "app.log");
    try {
      await writeFile(file, [
        "[2026-07-30 14:25:09.100 chat] INFO request accepted",
        "[2026-07-30 14:25:09.200 agentos] ERROR model request failed",
        "[2026-07-30 14:25:09.300 console] ERROR database request failed",
      ].join("\n"));

      const result = await readApplicationLogs({
        level: "ERROR",
        source: "agentos",
        query: "model",
        limit: 50,
      }, file);

      expect(result.available).toBe(true);
      expect(result.scanned).toBe(3);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({ source: "agentos", level: "ERROR" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
