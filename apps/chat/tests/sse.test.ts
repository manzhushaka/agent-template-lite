import { describe, expect, it } from "vitest";
import { createSseParser } from "../src/lib/sse";

describe("createSseParser", () => {
  it("handles JSON split across network chunks", () => {
    const events: unknown[] = [];
    const parser = createSseParser((event) => events.push(event));
    parser.push("event: RunContent\ndata: {\"event\":\"RunCon");
    parser.push("tent\",\"content\":\"你好\"}\n\n");
    parser.finish();
    expect(events).toEqual([{ event: "RunContent", data: { event: "RunContent", content: "你好" } }]);
  });
});
