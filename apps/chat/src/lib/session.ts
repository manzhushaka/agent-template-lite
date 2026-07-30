import { createUuid } from "./uuid";

const SESSION_KEY = "agent-template-session";
const SESSION_HISTORY_KEY = "agent-template-session-history";
const SESSION_HISTORY_LIMIT = 50;

type SessionStorage = Pick<Storage, "getItem" | "setItem">;

export interface BrowserSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
}

function parseSessionHistory(value: string | null): BrowserSessionSummary[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((session): session is BrowserSessionSummary => {
      if (!session || typeof session !== "object") return false;
      const candidate = session as Record<string, unknown>;
      return typeof candidate.id === "string"
        && typeof candidate.title === "string"
        && typeof candidate.updatedAt === "string";
    });
  } catch {
    return [];
  }
}

export function browserSessions(storage: Pick<Storage, "getItem">): BrowserSessionSummary[] {
  return parseSessionHistory(storage.getItem(SESSION_HISTORY_KEY));
}

export function rememberBrowserSession(
  storage: SessionStorage,
  session: BrowserSessionSummary,
): BrowserSessionSummary[] {
  const sessions = [session, ...browserSessions(storage).filter((item) => item.id !== session.id)]
    .slice(0, SESSION_HISTORY_LIMIT);
  storage.setItem(SESSION_HISTORY_KEY, JSON.stringify(sessions));
  return sessions;
}

export function activateBrowserSession(storage: Pick<Storage, "setItem">, sessionId: string): void {
  storage.setItem(SESSION_KEY, sessionId);
}

export function browserSessionId(storage: SessionStorage): string {
  const existing = storage.getItem(SESSION_KEY);
  if (existing) {
    if (!browserSessions(storage).some((session) => session.id === existing)) {
      rememberBrowserSession(storage, {
        id: existing,
        title: "当前会话",
        updatedAt: new Date().toISOString(),
      });
    }
    return existing;
  }
  const created = createUuid();
  activateBrowserSession(storage, created);
  rememberBrowserSession(storage, {
    id: created,
    title: "新会话",
    updatedAt: new Date().toISOString(),
  });
  return created;
}

export function resetBrowserSession(storage: SessionStorage): string {
  const created = createUuid();
  activateBrowserSession(storage, created);
  rememberBrowserSession(storage, {
    id: created,
    title: "新会话",
    updatedAt: new Date().toISOString(),
  });
  return created;
}
