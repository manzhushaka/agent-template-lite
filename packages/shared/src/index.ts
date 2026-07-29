/** Stable identifier used by Chat when calling the Agno AgentOS run endpoints. */
export const TEMPLATE_AGENT_ID = "business-demo-agent";

/**
 * Tool results use this envelope so Chat can render business data without parsing prose.
 * EXTENSION: Add a new card type to `DemoCard`, then register its renderer in Chat. Keep
 * the envelope stable so existing sessions remain readable after business features grow.
 */
export interface ToolResultEnvelope<T = unknown> {
  ok: boolean;
  code: string;
  message: string;
  data?: T;
  cards?: DemoCard[];
  idempotent?: boolean;
}

export interface ProductCard {
  type: "product";
  id: string;
  title: string;
  description: string;
  price: string;
  stock: number;
  imageUrl?: string;
  actionLabel?: string;
}

export interface OrderCard {
  type: "order";
  id: string;
  title: string;
  description: string;
  amount: string;
  status: string;
}

export type DemoCard = ProductCard | OrderCard;

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
