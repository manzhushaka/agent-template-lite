const SESSION_KEY = "agent-template-session";

export function browserSessionId(storage: Pick<Storage, "getItem" | "setItem">): string {
  const existing = storage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  storage.setItem(SESSION_KEY, created);
  return created;
}

export function resetBrowserSession(storage: Pick<Storage, "setItem">): string {
  const created = crypto.randomUUID();
  storage.setItem(SESSION_KEY, created);
  return created;
}
