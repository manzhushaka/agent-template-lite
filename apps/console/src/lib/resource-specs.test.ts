import { describe, expect, it } from "vitest";
import { demoResourceSpecs } from "./resource-specs";

describe("demo resource specs", () => {
  it("keeps the sample CRUD fields explicit", () => {
    const keys = demoResourceSpecs.products.fields.map((field) => field.key);
    expect(keys).toEqual(["sku", "name", "description", "priceCents", "stock", "status", "imageUrl"]);
    expect(demoResourceSpecs.products.fields.find((field) => field.key === "status")?.options).toHaveLength(3);
  });
});
