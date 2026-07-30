import { describe, expect, it } from "vitest";
import {
  activateBrowserSession,
  browserSessionId,
  browserSessions,
  rememberBrowserSession,
  resetBrowserSession,
} from "../src/lib/session";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("browser session history", () => {
  it("keeps the active session in a recent-first browser index", () => {
    const storage = memoryStorage();
    const firstSessionId = browserSessionId(storage);
    const secondSessionId = resetBrowserSession(storage);
    expect(firstSessionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(secondSessionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(secondSessionId).not.toBe(firstSessionId);
    expect(browserSessions(storage).map((session) => session.id)).toEqual([secondSessionId, firstSessionId]);

    activateBrowserSession(storage, firstSessionId);
    expect(browserSessionId(storage)).toBe(firstSessionId);
  });

  it("updates a session without duplicating it and ignores malformed storage", () => {
    const storage = memoryStorage();
    storage.setItem("agent-template-session-history", "not-json");
    expect(browserSessions(storage)).toEqual([]);

    rememberBrowserSession(storage, { id: "session-1", title: "首次咨询", updatedAt: "2026-07-29T01:00:00.000Z" });
    rememberBrowserSession(storage, { id: "session-1", title: "更新标题", updatedAt: "2026-07-29T02:00:00.000Z" });
    expect(browserSessions(storage)).toEqual([
      { id: "session-1", title: "更新标题", updatedAt: "2026-07-29T02:00:00.000Z" },
    ]);
  });
});
