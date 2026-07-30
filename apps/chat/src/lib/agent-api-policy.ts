import { TEMPLATE_AGENT_ID } from "@template/shared";

/** Keep the public BFF surface smaller than AgentOS itself. */
export function allowedAgentRequest(method: string, path: string[]) {
  const normalized = method.toUpperCase();
  return (normalized === "GET" && path.join("/") === "api/health")
    || (normalized === "GET" && path.length === 3 && path[0] === "sessions" && path[2] === "runs")
    || (normalized === "POST" && path.length === 3 && path[0] === "agents" && path[1] === TEMPLATE_AGENT_ID && path[2] === "runs")
    || (normalized === "POST" && path.length === 5 && path[0] === "agents" && path[1] === TEMPLATE_AGENT_ID && path[2] === "runs" && path[4] === "continue");
}
