import { describe, expect, it } from "vitest";
import { consumeRunLimit } from "../src/lib/rate-limit";

describe("run rate limit", () => {
  it("blocks calls above the configured window limit and resets later", () => {
    const key = crypto.randomUUID();
    expect(consumeRunLimit(key, 1_000, 2, 1_000).allowed).toBe(true);
    expect(consumeRunLimit(key, 1_100, 2, 1_000).allowed).toBe(true);
    expect(consumeRunLimit(key, 1_200, 2, 1_000)).toEqual({ allowed: false, retryAfter: 1 });
    expect(consumeRunLimit(key, 2_001, 2, 1_000).allowed).toBe(true);
  });
});
