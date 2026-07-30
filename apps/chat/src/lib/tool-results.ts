import { parseToolResultEnvelope, type DemoCard } from "@template/shared";

interface RunTool {
  tool_name?: string;
  result?: unknown;
  tool_call_error?: boolean;
}

/**
 * Convert Tool results into UI artifacts without inspecting model prose.
 * EXTENSION: New business Tools should return `ToolResultEnvelope.cards`; add rendering only
 * for genuinely new card shapes and keep generic error handling here unchanged.
 */
export function extractCards(tools: RunTool[] = []): DemoCard[] {
  return tools.flatMap((tool) => {
    if (tool.tool_call_error) return [];
    const envelope = parseToolResultEnvelope(tool.result);
    return envelope?.cards || [];
  });
}
