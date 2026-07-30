import { allowedAgentRequest } from "@/lib/agent-api-policy";
import { consumeRunLimit } from "@/lib/rate-limit";
import { assertSessionOwner, consoleChatRequest } from "@/lib/server-clients";
import { attachVisitorCookie, visitorIdentity } from "@/lib/visitor";

const agentBaseUrl = (process.env.AGENTOS_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
type Context = { params: Promise<{ path?: string[] }> };

/**
 * Server-side BFF for AgentOS. Browser code never receives the internal token or the private
 * AgentOS address. EXTENSION: Forward a new header only after checking that it contains no
 * browser-controlled credential that the downstream service could mistakenly trust.
 */
async function proxy(request: Request, context: Context): Promise<Response> {
  const { path = [] } = await context.params;
  const method = request.method.toUpperCase();
  const hasRequestBody = !new Set(["GET", "HEAD"]).has(method);
  const healthRequest = method === "GET" && path.join("/") === "api/health";
  if (!allowedAgentRequest(method, path)) {
    return Response.json({ detail: "接口不可用" }, { status: 404 });
  }
  const visitor = healthRequest ? null : visitorIdentity(request);
  const target = new URL(`${agentBaseUrl}/${path.map(encodeURIComponent).join("/")}`);
  target.search = new URL(request.url).search;
  const headers = new Headers();
  for (const name of ["accept", "content-type", "user-agent"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const token = process.env.INTERNAL_API_TOKEN;
  if (token) headers.set("authorization", `Bearer ${token}`);
  try {
    let body: BodyInit | undefined;
    let sessionId = path[0] === "sessions" && path[1] ? path[1] : "";
    const contentType = request.headers.get("content-type") || "";
    if (hasRequestBody && contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const suppliedSessionId = form.get("session_id");
      if (typeof suppliedSessionId === "string") sessionId = suppliedSessionId;
      form.set("user_id", visitor!.id);
      headers.delete("content-type");
      body = form;
    } else if (hasRequestBody) {
      body = await request.arrayBuffer();
    }
    if (sessionId) await assertSessionOwner(visitor!.id, sessionId);
    if (method === "POST" && path.includes("runs")) {
      const forwardedFor = request.headers.get("x-forwarded-for")?.split(",", 1)[0].trim() || "local";
      const rate = consumeRunLimit(`${visitor!.id}:${forwardedFor}`);
      if (!rate.allowed) {
        return attachVisitorCookie(Response.json({ detail: "请求过于频繁，请稍后重试" }, { status: 429, headers: { "retry-after": String(rate.retryAfter) } }), visitor!);
      }
    }
    const response = await fetch(target, {
      method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(180_000),
    });
    const outbound = new Headers();
    for (const name of ["content-type", "cache-control", "location", "set-cookie"]) {
      const value = response.headers.get(name);
      if (value) outbound.set(name, value);
    }
    if (sessionId && response.ok && method === "POST") {
      await consoleChatRequest(`/api/internal/chat/sessions/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        body: JSON.stringify({ visitorId: visitor!.id, touch: true }),
      });
    }
    const proxied = new Response(response.body, { status: response.status, headers: outbound });
    return visitor ? attachVisitorCookie(proxied, visitor) : proxied;
  } catch {
    const unavailable = Response.json({ detail: "会话不存在或 AgentOS 服务暂时不可用" }, { status: 502 });
    return visitor ? attachVisitorCookie(unavailable, visitor) : unavailable;
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
