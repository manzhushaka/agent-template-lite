import { describe, expect, it } from "vitest";
import { TEMPLATE_AGENT_ID } from "@template/shared";
import { allowedAgentRequest } from "../src/lib/agent-api-policy";

describe("AgentOS BFF allowlist", () => {
  it("allows only the health, owned history, run and continue surfaces", () => {
    expect(allowedAgentRequest("GET", ["api", "health"])).toBe(true);
    expect(allowedAgentRequest("GET", ["sessions", "session-1", "runs"])).toBe(true);
    expect(allowedAgentRequest("POST", ["agents", TEMPLATE_AGENT_ID, "runs"])).toBe(true);
    expect(allowedAgentRequest("POST", ["agents", TEMPLATE_AGENT_ID, "runs", "run-1", "continue"])).toBe(true);
    expect(allowedAgentRequest("GET", ["openapi.json"])).toBe(false);
    expect(allowedAgentRequest("POST", ["agents", "other-agent", "runs"])).toBe(false);
    expect(allowedAgentRequest("DELETE", ["sessions", "session-1"])).toBe(false);
  });
});
