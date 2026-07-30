import http from "node:http";

function sse(response, events) {
  response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
  for (const event of events) response.write(`data: ${JSON.stringify(event)}\n\n`);
  response.end();
}

http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/api/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (request.method === "POST" && request.url === "/api/admin/knowledge/reindex") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", indexedIds: [1], count: 1 }));
    return;
  }
  if (request.method === "GET" && /^\/sessions\/[^/]+\/runs/.test(request.url || "")) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("[]");
    return;
  }
  if (request.method === "POST" && /\/continue$/.test(request.url || "")) {
    const result = JSON.stringify({ ok: true, code: "ORDER_CREATED", message: "ok", cards: [{ type: "order", id: "D-E2E", title: "订单 D-E2E", description: "山野茶礼盒 × 1", amount: "¥168.00", status: "CREATED" }] });
    sse(response, [{ event: "RunCompleted", run_id: "run-order", status: "COMPLETED", content: "演示订单已创建", tools: [{ tool_name: "confirm_order", result, confirmed: true }] }]);
    return;
  }
  if (request.method === "POST" && /\/runs$/.test(request.url || "")) {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      if (body.includes("我选择商品")) {
        sse(response, [{ event: "RunPaused", run_id: "run-confirm", status: "PAUSED", tools: [{ tool_call_id: "tool-confirm", tool_name: "confirm_order", tool_args: { quote_id: "Q-E2E" }, requires_confirmation: true, confirmed: null }] }]);
        return;
      }
      const result = JSON.stringify({ ok: true, code: "PRODUCTS_FOUND", message: "ok", cards: [{ type: "product", id: "GIFT-TEA-001", title: "山野茶礼盒", description: "适合商务赠礼", price: "¥168.00", stock: 30, actionLabel: "选择商品" }] });
      sse(response, [{ event: "RunCompleted", run_id: "run-products", status: "COMPLETED", content: "已为你找到商品。", tools: [{ tool_name: "search_products", result }] }]);
    });
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ detail: "not found" }));
}).listen(18000, "127.0.0.1", () => console.log("Mock AgentOS listening on 18000"));
