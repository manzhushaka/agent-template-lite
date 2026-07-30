import { beforeEach, describe, expect, it } from "vitest";
import { attachVisitorCookie, visitorIdentity } from "../src/lib/visitor";

describe("visitor identity", () => {
  beforeEach(() => {
    process.env.CHAT_VISITOR_SECRET = "test-only-chat-visitor-secret-with-enough-entropy";
  });

  it("creates a signed identity and restores it from the HttpOnly cookie", () => {
    const created = visitorIdentity(new Request("http://localhost"));
    const response = attachVisitorCookie(new Response(null), created);
    const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
    expect(created.isNew).toBe(true);
    expect(cookie).toContain("agent_template_visitor=");

    const restored = visitorIdentity(new Request("http://localhost", { headers: { cookie: cookie || "" } }));
    expect(restored.id).toBe(created.id);
    expect(restored.isNew).toBe(false);
  });

  it("rejects a modified cookie", () => {
    const created = visitorIdentity(new Request("http://localhost"));
    const modified = `${created.token.slice(0, -1)}x`;
    const restored = visitorIdentity(new Request("http://localhost", { headers: { cookie: `agent_template_visitor=${modified}` } }));
    expect(restored.id).not.toBe(created.id);
    expect(restored.isNew).toBe(true);
  });
});
