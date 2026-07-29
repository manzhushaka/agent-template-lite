export interface SseEvent<T = unknown> {
  event: string;
  data: T;
}

function parseEvent(block: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }
  if (!data.length) return null;
  return { event, data: JSON.parse(data.join("\n")) };
}

/**
 * Incremental parser for Agno's server-sent events. Network chunks can split JSON at any byte,
 * so consumers must not parse each `reader.read()` result independently.
 */
export function createSseParser(onEvent: (event: SseEvent) => void) {
  let buffer = "";
  const drain = (flush = false) => {
    let boundary = buffer.search(/\r?\n\r?\n/);
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      const separatorLength = buffer[boundary] === "\r" ? 4 : 2;
      buffer = buffer.slice(boundary + separatorLength);
      const parsed = parseEvent(block);
      if (parsed) onEvent(parsed);
      boundary = buffer.search(/\r?\n\r?\n/);
    }
    if (flush && buffer.trim()) {
      const parsed = parseEvent(buffer);
      buffer = "";
      if (parsed) onEvent(parsed);
    }
  };
  return {
    push(chunk: string) { buffer += chunk; drain(); },
    finish() { drain(true); },
  };
}

export async function consumeSseStream(stream: ReadableStream<Uint8Array>, onEvent: (event: SseEvent) => void) {
  const parser = createSseParser(onEvent);
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true }));
  }
  parser.push(decoder.decode());
  parser.finish();
}
