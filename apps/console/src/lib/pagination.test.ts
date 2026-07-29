import { describe, expect, it } from "vitest";
import {
  paginationInput,
  paginationMeta,
  paginationOffset,
  paginationSchema,
} from "./pagination";

describe("pagination", () => {
  it("uses stable defaults", () => {
    const parsed = paginationSchema.parse(paginationInput(new URLSearchParams()));

    expect(parsed).toEqual({ page: 1, pageSize: 10 });
    expect(paginationOffset(parsed)).toBe(0);
  });

  it("calculates offsets and page totals", () => {
    const parsed = paginationSchema.parse(
      paginationInput(new URLSearchParams("page=3&pageSize=20")),
    );

    expect(paginationOffset(parsed)).toBe(40);
    expect(paginationMeta(parsed, 45)).toEqual({
      page: 3,
      pageSize: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it("rejects invalid or excessive page sizes", () => {
    expect(
      paginationSchema.safeParse(paginationInput(new URLSearchParams("page=0"))).success,
    ).toBe(false);
    expect(
      paginationSchema.safeParse(paginationInput(new URLSearchParams("pageSize=101"))).success,
    ).toBe(false);
  });
});
