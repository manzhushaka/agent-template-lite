import { describe, expect, it } from "vitest";
import { restoreConversation } from "../src/lib/chat-history";

describe("restoreConversation", () => {
  it("restores user, assistant, cards and a pending confirmation from Agno runs", () => {
    const conversation = restoreConversation([
      {
        run_id: "run-1",
        run_input: "推荐一个商品",
        status: "COMPLETED",
        content: "为你找到一个商品。",
        tools: [{
          tool_name: "search_products",
          result: JSON.stringify({
            ok: true,
            code: "OK",
            message: "ok",
            cards: [{ type: "product", id: "SKU-1", title: "示例", description: "", price: "¥1.00", stock: 2 }],
          }),
        }],
      },
      {
        run_id: "run-2",
        run_input: "创建订单",
        status: "PAUSED",
        content: "",
        tools: [{ tool_name: "confirm_order", tool_args: { quote_id: "Q-1" }, requires_confirmation: true, confirmed: null }],
      },
    ]);

    expect(conversation.messages.map((message) => [message.role, message.content])).toEqual([
      ["user", "推荐一个商品"],
      ["assistant", "为你找到一个商品。"],
      ["user", "创建订单"],
      ["assistant", "请确认是否继续执行。"],
    ]);
    expect(conversation.messages[1]?.cards).toHaveLength(1);
    expect(conversation.approval?.runId).toBe("run-2");
  });

  it("clears an older paused approval after a later completed run", () => {
    const conversation = restoreConversation([
      { run_id: "run-1", status: "PAUSED", tools: [{ requires_confirmation: true, confirmed: null }] },
      { run_id: "run-2", parent_run_id: "run-1", status: "COMPLETED", content: "操作完成" },
    ]);
    expect(conversation.messages).toEqual([
      { id: "run-1-assistant", role: "assistant", content: "请确认是否继续执行。", cards: [] },
      { id: "run-2-assistant", role: "assistant", content: "操作完成", cards: [] },
    ]);
    expect(conversation.approval).toBeNull();
  });
});
