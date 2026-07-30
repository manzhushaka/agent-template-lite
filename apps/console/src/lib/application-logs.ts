import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import path from "node:path";

export const applicationLogLevels = ["DEBUG", "INFO", "WARN", "ERROR"] as const;
export const applicationLogSources = ["chat", "console", "agentos", "knowledge-worker", "system"] as const;

export type ApplicationLogLevel = (typeof applicationLogLevels)[number];
export type ApplicationLogSource = (typeof applicationLogSources)[number];

export interface ApplicationLogEntry {
  id: string;
  timestamp: string | null;
  level: ApplicationLogLevel;
  source: ApplicationLogSource;
  message: string;
}

export interface ApplicationLogQuery {
  level?: ApplicationLogLevel;
  source?: ApplicationLogSource;
  query?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 300;
const MAX_LIMIT = 500;
const MAX_READ_BYTES = 2 * 1024 * 1024;
const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");
const PREFIX_WITH_TIME = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+(chat|console|agentos|knowledge-worker)\]\s*/;
const LEGACY_PREFIX = /^\[(chat|console|agentos|knowledge-worker)\]\s*/;

function projectRoot(): string {
  const current = process.cwd();
  return current.endsWith(path.join("apps", "console")) ? path.resolve(current, "../..") : current;
}

export function applicationLogPath(): string {
  const configured = process.env.APP_LOG_FILE?.trim();
  if (!configured) return path.join(projectRoot(), "var", "logs", "app.log");
  return path.isAbsolute(configured) ? configured : path.resolve(projectRoot(), configured);
}

function normalizeTimestamp(value: string): string | null {
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function detectLevel(message: string): ApplicationLogLevel {
  const explicit = message.match(/(?:^|[\s|\[])\b(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|CRITICAL)\b/i)?.[1]?.toUpperCase();
  if (explicit === "DEBUG") return "DEBUG";
  if (explicit === "WARN" || explicit === "WARNING") return "WARN";
  if (explicit === "ERROR" || explicit === "FATAL" || explicit === "CRITICAL") return "ERROR";
  if (/\b(error|failed|failure|exception|traceback)\b/i.test(message)) return "ERROR";
  if (/\b(warn|warning|deprecated)\b/i.test(message) || message.includes("⚠")) return "WARN";
  if (/\bdebug\b/i.test(message)) return "DEBUG";
  return "INFO";
}

export function redactApplicationLog(value: string): string {
  return value
    .replace(ANSI_ESCAPE, "")
    .replace(/\b(authorization|x-internal-token|cookie|set-cookie)\s*[:=]\s*(?:Bearer\s+)?[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/("(?:authorization|x-internal-token|cookie|set-cookie)"\s*:\s*")[^"]*(")/gi, "$1[REDACTED]$2")
    .replace(/\b([A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|DATABASE_URL|MYSQL_URL))\s*=\s*[^\s]+/gi, "$1=[REDACTED]")
    .replace(/([a-z][a-z0-9+.-]*:\/\/[^:\s/@]+):([^@\s/]+)@/gi, "$1:[REDACTED]@")
    .replace(/("(?:password|token|secret|apiKey|api_key)"\s*:\s*")[^"]*(")/gi, "$1[REDACTED]$2");
}

export function parseApplicationLogLine(line: string, lineNumber = 0): ApplicationLogEntry | null {
  let message = redactApplicationLog(line).trimEnd();
  if (!message.trim()) return null;

  let timestamp: string | null = null;
  let source: ApplicationLogSource = "system";
  const timedPrefix = message.match(PREFIX_WITH_TIME);
  if (timedPrefix) {
    timestamp = normalizeTimestamp(timedPrefix[1]);
    source = timedPrefix[2] as ApplicationLogSource;
    message = message.slice(timedPrefix[0].length);
  } else {
    const legacyPrefix = message.match(LEGACY_PREFIX);
    if (legacyPrefix) {
      source = legacyPrefix[1] as ApplicationLogSource;
      message = message.slice(legacyPrefix[0].length);
    }
  }

  const level = detectLevel(message);
  const digest = createHash("sha1").update(`${lineNumber}:${line}`).digest("hex").slice(0, 12);
  return { id: `${source}-${digest}`, timestamp, level, source, message: message || "--" };
}

export async function readApplicationLogs(
  query: ApplicationLogQuery = {},
  filePath = applicationLogPath(),
) {
  const limit = Math.max(1, Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT));
  let handle;
  try {
    handle = await open(filePath, "r");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyApplicationLogs(limit);
    }
    throw error;
  }

  try {
    const stat = await handle.stat();
    const bytesToRead = Math.min(stat.size, MAX_READ_BYTES);
    const start = Math.max(0, stat.size - bytesToRead);
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await handle.read(buffer, 0, bytesToRead, start);
    let content = buffer.subarray(0, bytesRead).toString("utf8");
    if (start > 0) {
      const firstNewline = content.indexOf("\n");
      content = firstNewline >= 0 ? content.slice(firstNewline + 1) : "";
    }

    const entries = content
      .split(/\r?\n/)
      .map((line, index) => parseApplicationLogLine(line, index))
      .filter((entry): entry is ApplicationLogEntry => entry !== null);
    const normalizedQuery = query.query?.trim().toLocaleLowerCase() || "";
    const matched = entries.filter((entry) =>
      (!query.level || entry.level === query.level)
      && (!query.source || entry.source === query.source)
      && (!normalizedQuery || `${entry.source} ${entry.level} ${entry.message}`.toLocaleLowerCase().includes(normalizedQuery))
    );
    const counts = Object.fromEntries(applicationLogLevels.map((level) => [
      level,
      entries.filter((entry) => entry.level === level).length,
    ])) as Record<ApplicationLogLevel, number>;

    return {
      items: matched.slice(-limit).reverse(),
      counts,
      matched: matched.length,
      scanned: entries.length,
      limit,
      truncated: start > 0 || matched.length > limit,
      available: true,
      updatedAt: stat.mtime.toISOString(),
    };
  } finally {
    await handle.close();
  }
}

function emptyApplicationLogs(limit: number) {
  return {
    items: [] as ApplicationLogEntry[],
    counts: { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 } satisfies Record<ApplicationLogLevel, number>,
    matched: 0,
    scanned: 0,
    limit,
    truncated: false,
    available: false,
    updatedAt: null,
  };
}
