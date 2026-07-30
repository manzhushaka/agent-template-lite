export { PROJECT_CONFIG, TEMPLATE_AGENT_ID } from "./project-config";
export {
  DemoCardSchema,
  OrderCardSchema,
  ProductCardSchema,
  ToolResultEnvelopeSchema,
  parseToolResultEnvelope,
} from "./contracts";
export type { DemoCard, OrderCard, ProductCard, ToolResultEnvelope } from "./contracts";

export interface DemoProduct {
  id: number;
  sku: string;
  name: string;
  description: string;
  priceCents: number;
  stock: number;
  status: "ON_SALE" | "DRAFT" | "OFF_SHELF";
  imageUrl: string | null;
  updatedAt: string;
}

export interface DemoOrder {
  id: number;
  orderNo: string;
  sessionId: string;
  productId: number;
  productName: string;
  quantity: number;
  amountCents: number;
  status: "CREATED" | "CANCELLED";
  createdAt: string;
}

export const servicePaths = {
  agentHealth: "/api/health",
  products: "/api/demo/products",
  orders: "/api/demo/orders",
  knowledge: "/api/knowledge",
} as const;
