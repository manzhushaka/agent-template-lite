import type { DemoCard } from "@template/shared";
import { extractCards } from "./tool-results";

export interface HistoricalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards?: DemoCard[];
}

export interface HistoricalTool {
  tool_name?: string;
  name?: string;
  tool_args?: Record<string, unknown>;
  requires_confirmation?: boolean;
  confirmed?: boolean | null;
  result?: unknown;
  tool_call_error?: boolean;
}

export interface HistoricalApproval {
  runId: string;
  tools: HistoricalTool[];
  pendingTools: HistoricalTool[];
}

export interface RestoredConversation {
  messages: HistoricalMessage[];
  approval: HistoricalApproval | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseTools(value: unknown): HistoricalTool[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((tool) => ({
    tool_name: typeof tool.tool_name === "string" ? tool.tool_name : undefined,
    name: typeof tool.name === "string" ? tool.name : undefined,
    tool_args: isRecord(tool.tool_args) ? tool.tool_args : undefined,
    requires_confirmation: typeof tool.requires_confirmation === "boolean"
      ? tool.requires_confirmation
      : undefined,
    confirmed: typeof tool.confirmed === "boolean" || tool.confirmed === null
      ? tool.confirmed
      : undefined,
    result: tool.result,
    tool_call_error: typeof tool.tool_call_error === "boolean" ? tool.tool_call_error : undefined,
  }));
}

/** Convert persisted Agno runs back into the Chat-only rendering contract. */
export function restoreConversation(value: unknown): RestoredConversation {
  if (!Array.isArray(value)) return { messages: [], approval: null };
  const messages: HistoricalMessage[] = [];
  let approval: HistoricalApproval | null = null;

  value.forEach((value, index) => {
    if (!isRecord(value)) return;
    const runId = typeof value.run_id === "string" && value.run_id ? value.run_id : `run-${index}`;
    const input = typeof value.run_input === "string" ? value.run_input.trim() : "";
    const parentRunId = typeof value.parent_run_id === "string" ? value.parent_run_id : "";
    if (input && !parentRunId) {
      messages.push({ id: `${runId}-user`, role: "user", content: input });
    }

    const tools = parseTools(value.tools);
    const cards = extractCards(tools);
    const content = typeof value.content === "string" ? value.content.trim() : "";
    const status = typeof value.status === "string" ? value.status.toUpperCase() : "";
    if (content || cards.length || status === "PAUSED") {
      messages.push({
        id: `${runId}-assistant`,
        role: "assistant",
        content: content || (cards.length ? "业务数据已经准备好。" : "请确认是否继续执行。"),
        cards,
      });
    }

    const pendingTools = tools.filter((tool) => tool.requires_confirmation && tool.confirmed == null);
    approval = status === "PAUSED" && pendingTools.length
      ? { runId, tools, pendingTools }
      : null;
  });

  return { messages, approval };
}
