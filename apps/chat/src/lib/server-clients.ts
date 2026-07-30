const consoleUrl = (process.env.CONSOLE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const agentosUrl = (process.env.AGENTOS_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function jsonResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body.message || body.detail || `下游请求失败（${response.status}）`));
  return body;
}

export async function consoleChatRequest(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("x-internal-token", process.env.INTERNAL_API_TOKEN || "");
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return jsonResponse(await fetch(`${consoleUrl}${path}`, { ...options, headers, cache: "no-store", signal: AbortSignal.timeout(15_000) }));
}

export async function agentosAdminRequest(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("authorization", `Bearer ${process.env.INTERNAL_API_TOKEN || ""}`);
  const response = await fetch(`${agentosUrl}${path}`, { ...options, headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (response.status === 204) return null;
  return jsonResponse(response);
}

export async function assertSessionOwner(visitorId: string, sessionId: string) {
  await consoleChatRequest(`/api/internal/chat/sessions/${encodeURIComponent(sessionId)}?visitorId=${encodeURIComponent(visitorId)}`);
}
