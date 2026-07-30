import { v4 as uuidv4 } from "uuid";

/** Creates a UUID through the uuid package's browser-compatible random source. */
export function createUuid(): string {
  return uuidv4();
}
