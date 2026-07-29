import type { DemoCard, ToolResultEnvelope } from "@template/shared";

interface RunTool {
  tool_name?: string;
  result?: unknown;
  tool_call_error?: boolean;
}

function parseEnvelope(value: unknown): ToolResultEnvelope | null {
  if (typeof value !== "string") return value && typeof value === "object" ? value as ToolResultEnvelope : null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
  } catch {
    return null;
  }
}

/**
 * Convert Tool results into UI artifacts without inspecting model prose.
 * EXTENSION: New business Tools should return `ToolResultEnvelope.cards`; add rendering only
 * for genuinely new card shapes and keep generic error handling here unchanged.
 */
export function extractCards(tools: RunTool[] = []): DemoCard[] {
  return tools.flatMap((tool) => {
    if (tool.tool_call_error) return [];
    const envelope = parseEnvelope(tool.result);
    return Array.isArray(envelope?.cards) ? envelope.cards : [];
  });
}
