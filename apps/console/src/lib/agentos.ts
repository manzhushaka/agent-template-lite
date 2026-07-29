const agentosUrl = (process.env.AGENTOS_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export async function agentosRequest(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("authorization", `Bearer ${process.env.INTERNAL_API_TOKEN || ""}`);
  const response = await fetch(`${agentosUrl}${path}`, { ...options, headers, signal: AbortSignal.timeout(30_000), cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body.detail || `AgentOS 请求失败（${response.status}）`));
  return body;
}

export async function requestKnowledgeReindex() {
  return agentosRequest("/api/admin/knowledge/reindex", { method: "POST" });
}
