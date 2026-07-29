export interface ResourceField {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "url";
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
}

/**
 * Resource definitions keep simple demo CRUD consistent without becoming a runtime low-code
 * platform. EXTENSION: Add a spec for table-shaped data; create a dedicated page and service
 * when the business interaction is more complex than CRUD.
 */
export const demoResourceSpecs = {
  products: {
    title: "演示商品",
    description: "维护 Agent 推荐和下单时使用的真实演示数据。",
    fields: [
      { key: "sku", label: "SKU", type: "text", required: true },
      { key: "name", label: "商品名称", type: "text", required: true },
      { key: "description", label: "商品说明", type: "textarea", required: true },
      { key: "priceCents", label: "价格（分）", type: "number", required: true },
      { key: "stock", label: "库存", type: "number", required: true },
      { key: "status", label: "状态", type: "select", required: true, options: [
        { label: "在售", value: "ON_SALE" }, { label: "草稿", value: "DRAFT" }, { label: "下架", value: "OFF_SHELF" },
      ] },
      { key: "imageUrl", label: "图片 URL", type: "url" },
    ] satisfies ResourceField[],
  },
} as const;
