import { describe, expect, it } from "vitest";
import { extractCards } from "../src/lib/tool-results";

describe("extractCards", () => {
  it("reads shared card envelopes and ignores failed tools", () => {
    const cards = extractCards([
      { tool_name: "search_products", result: JSON.stringify({ ok: true, code: "OK", message: "ok", cards: [{ type: "product", id: "SKU-1", title: "示例", description: "", price: "¥1.00", stock: 2 }] }) },
      { tool_name: "broken", result: "not-json", tool_call_error: true },
    ]);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.id).toBe("SKU-1");
  });
});
