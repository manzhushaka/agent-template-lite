import { z } from "zod";

export const ProductCardSchema = z.object({
  type: z.literal("product"),
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  price: z.string().min(1),
  stock: z.number().int().nonnegative(),
  imageUrl: z.string().url().optional(),
  actionLabel: z.string().min(1).optional(),
}).strict();

export const OrderCardSchema = z.object({
  type: z.literal("order"),
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  amount: z.string().min(1),
  status: z.string().min(1),
}).strict();

export const DemoCardSchema = z.discriminatedUnion("type", [ProductCardSchema, OrderCardSchema]);

export const ToolResultEnvelopeSchema = z.object({
  ok: z.boolean(),
  code: z.string().min(1),
  message: z.string(),
  data: z.unknown().optional(),
  cards: z.array(DemoCardSchema).default([]),
  idempotent: z.boolean().optional(),
}).strict();

export type ProductCard = z.infer<typeof ProductCardSchema>;
export type OrderCard = z.infer<typeof OrderCardSchema>;
export type DemoCard = z.infer<typeof DemoCardSchema>;

export interface ToolResultEnvelope<T = unknown> {
  ok: boolean;
  code: string;
  message: string;
  data?: T;
  cards?: DemoCard[];
  idempotent?: boolean;
}

/** Validate untrusted Python Tool output before it reaches a card renderer. */
export function parseToolResultEnvelope(value: unknown): ToolResultEnvelope | null {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
      if (typeof candidate === "string") candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  const parsed = ToolResultEnvelopeSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
