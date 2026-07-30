import type { DemoCard } from "@template/shared";
import type { HistoricalTool } from "./chat-history";
import { consumeSseStream } from "./sse";
import { extractCards } from "./tool-results";

export type ConfirmationTool = HistoricalTool & { tool_call_id?: string };

export interface AgentRunResult {
  content: string;
  cards: DemoCard[];
  tools: ConfirmationTool[];
  runId: string;
  status: string;
}

function formBody(values: Record<string, unknown>): FormData {
  const body = new FormData();
  Object.entries(values).forEach(([key, value]) => body.append(key, String(value)));
  return body;
}

/** Consume one Agno Run while keeping transport parsing outside the React component. */
export async function streamAgentRun(
  url: string,
  values: Record<string, unknown>,
  onContent: (content: string) => void,
): Promise<AgentRunResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "text/event-stream" },
    body: formBody({ ...values, stream: true }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `请求失败（${response.status}）`);
  }
  if (!response.body) throw new Error("浏览器不支持流式响应");

  const tools = new Map<string, ConfirmationTool>();
  let terminal: Record<string, unknown> | null = null;
  let streamError = "";
  let content = "";
  await consumeSseStream(response.body, ({ event, data }) => {
    const payload = data as Record<string, unknown>;
    const name = String(payload.event || event);
    const incoming = [
      ...(Array.isArray(payload.tools) ? payload.tools : []),
      ...(payload.tool ? [payload.tool] : []),
    ] as ConfirmationTool[];
    incoming.forEach((tool) => tools.set(tool.tool_call_id || `${tool.tool_name}:${JSON.stringify(tool.tool_args || {})}`, tool));
    if (name === "RunContent" && typeof payload.content === "string") {
      content += payload.content;
      onContent(payload.content);
    }
    if (name === "RunError") streamError = String(payload.content || "智能体响应失败");
    if (name === "RunCompleted" || name === "RunPaused") {
      terminal = { ...payload, status: name === "RunPaused" ? "PAUSED" : payload.status || "COMPLETED" };
    }
  });
  if (streamError) throw new Error(streamError);
  if (!terminal) throw new Error("流式响应意外结束");
  const run = terminal as Record<string, unknown>;
  const toolList = [...tools.values()];
  const cards = extractCards(toolList);
  return {
    content: content || String(run.content || (cards.length ? "业务数据已经准备好。" : "操作已经完成。")),
    cards,
    tools: toolList,
    runId: String(run.run_id || ""),
    status: String(run.status || "COMPLETED"),
  };
}
