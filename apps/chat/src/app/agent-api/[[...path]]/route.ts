const agentBaseUrl = (process.env.AGENTOS_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
type Context = { params: Promise<{ path?: string[] }> };

/**
 * Server-side BFF for AgentOS. Browser code never receives the internal token or the private
 * AgentOS address. EXTENSION: Forward a new header only after checking that it contains no
 * browser-controlled credential that the downstream service could mistakenly trust.
 */
async function proxy(request: Request, context: Context): Promise<Response> {
  const { path = [] } = await context.params;
  const target = new URL(`${agentBaseUrl}/${path.map(encodeURIComponent).join("/")}`);
  target.search = new URL(request.url).search;
  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie", "user-agent"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const token = process.env.INTERNAL_API_TOKEN;
  if (token) headers.set("authorization", `Bearer ${token}`);
  const method = request.method.toUpperCase();
  try {
    const response = await fetch(target, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
      redirect: "manual",
      signal: AbortSignal.timeout(180_000),
    });
    const outbound = new Headers();
    for (const name of ["content-type", "cache-control", "location", "set-cookie"]) {
      const value = response.headers.get(name);
      if (value) outbound.set(name, value);
    }
    return new Response(response.body, { status: response.status, headers: outbound });
  } catch {
    return Response.json({ detail: "AgentOS 服务暂时不可用" }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
