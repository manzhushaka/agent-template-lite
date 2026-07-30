/* eslint-disable @next/next/no-img-element */
import type { DemoCard } from "@template/shared";
import { Check, PackageSearch } from "lucide-react";

interface CardRendererProps {
  card: DemoCard;
  onSelectProduct: (sku: string) => void;
}

/** EXTENSION: Register a new stable card variant here after extending the shared union. */
export function CardRenderer({ card, onSelectProduct }: CardRendererProps) {
  if (card.type === "product") {
    return <section className="result-card product-card">
      {card.imageUrl ? <img src={card.imageUrl} alt={card.title} /> : <div className="image-fallback"><PackageSearch /></div>}
      <div><small>推荐商品</small><h2>{card.title}</h2><p>{card.description}</p><footer><strong>{card.price}</strong><span>库存 {card.stock}</span><button onClick={() => onSelectProduct(card.id)}>{card.actionLabel || "选择"}</button></footer></div>
    </section>;
  }
  return <section className="result-card order-card"><Check size={22} /><div><small>{card.status}</small><h2>{card.title}</h2><p>{card.description}</p><strong>{card.amount}</strong></div></section>;
}
