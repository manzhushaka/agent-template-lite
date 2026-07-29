"use client";

import { Boxes, ClipboardList, Plus, RefreshCw, Search, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { DemoOrder, DemoProduct } from "@template/shared";
import { publicPath } from "@/lib/public-path";
import { demoResourceSpecs } from "@/lib/resource-specs";

const emptyProduct: Omit<DemoProduct, "id" | "updatedAt"> = { sku: "", name: "", description: "", priceCents: 100, stock: 10, status: "DRAFT", imageUrl: "" };

/**
 * Sample CRUD surface. EXTENSION: Reuse the filter/table/drawer interaction for another simple
 * resource, but move domain rules into a server-side service and validate every Route Handler.
 */
export function DemoCenter() {
  const [tab, setTab] = useState<"products" | "orders">("products");
  const [products, setProducts] = useState<DemoProduct[]>([]);
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [editing, setEditing] = useState<Partial<DemoProduct> | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const spec = demoResourceSpecs.products;

  async function load() {
    const [productResponse, orderResponse] = await Promise.all([fetch(publicPath("/api/demo/products"), { cache: "no-store" }), fetch(publicPath("/api/demo/orders"), { cache: "no-store" })]);
    const [productBody, orderBody] = await Promise.all([productResponse.json(), orderResponse.json()]);
    if (productResponse.ok) setProducts(productBody.items || []);
    if (orderResponse.ok) setOrders(orderBody.items || []);
  }
  useEffect(() => { void load(); }, []);
  const visible = useMemo(() => products.filter((item) => `${item.sku}${item.name}${item.description}`.toLowerCase().includes(query.toLowerCase())), [products, query]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { ...values, id: editing?.id, priceCents: Number(values.priceCents), stock: Number(values.stock) };
    const response = await fetch(publicPath("/api/demo/products"), { method: editing?.id ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setMessage(body.message || "保存失败"); return; }
    setProducts(body.items || []); setEditing(null); setMessage("商品已保存");
  }

  return <><div className="segmented-control"><button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}><Boxes size={16} />商品数据</button><button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}><ClipboardList size={16} />订单记录</button></div>{tab === "products" ? <><form className="filter-bar" onSubmit={(event) => event.preventDefault()}><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 SKU、名称或说明" /></label><button type="button" className="icon-command" onClick={() => void load()} title="刷新" aria-label="刷新"><RefreshCw size={17} /></button><button type="button" className="primary-command" onClick={() => setEditing(emptyProduct)}><Plus size={17} />新增商品</button></form><section className="section-block table-only"><div className="data-table product-table"><div className="data-row data-head"><span>商品</span><span>价格</span><span>库存</span><span>状态</span><span>更新时间</span></div>{visible.map((item) => <button className="data-row editable-row" key={item.id} onClick={() => setEditing(item)}><span><strong>{item.name}</strong><small>{item.sku}</small></span><span>¥{(item.priceCents / 100).toFixed(2)}</span><span>{item.stock}</span><span><i className={`state ${item.status === "ON_SALE" ? "success" : "neutral"}`}>{item.status}</i></span><span>{new Date(item.updatedAt).toLocaleString("zh-CN")}</span></button>)}</div></section></> : <section className="section-block table-only"><div className="data-table order-table"><div className="data-row data-head"><span>订单号</span><span>商品</span><span>数量</span><span>金额</span><span>状态</span><span>创建时间</span></div>{orders.map((item) => <div className="data-row" key={item.id}><span>{item.orderNo}</span><span>{item.productName}</span><span>{item.quantity}</span><span>¥{(item.amountCents / 100).toFixed(2)}</span><span><i className="state success">{item.status}</i></span><span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span></div>)}</div></section>}{message && <p className="toast-message">{message}</p>}{editing && <div className="drawer-layer"><button className="drawer-scrim" onClick={() => setEditing(null)} aria-label="关闭" /><aside className="drawer" role="dialog" aria-modal="true"><header><div><small>DEMO RESOURCE</small><h2>{editing.id ? "编辑商品" : "新增商品"}</h2></div><button className="icon-command" onClick={() => setEditing(null)} aria-label="关闭"><X size={18} /></button></header><form onSubmit={save}><div className="form-grid">{spec.fields.map((field) => <label className={field.type === "textarea" || field.type === "url" ? "full" : ""} key={field.key}><span>{field.label}</span>{field.type === "textarea" ? <textarea name={field.key} defaultValue={String(editing[field.key as keyof DemoProduct] ?? "")} rows={6} required={field.required} /> : field.type === "select" ? <select name={field.key} defaultValue={String(editing[field.key as keyof DemoProduct] ?? "")} required={field.required}>{field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select> : <input name={field.key} type={field.type} defaultValue={String(editing[field.key as keyof DemoProduct] ?? "")} required={field.required} />}</label>)}</div>{message && <p className="form-error">{message}</p>}<footer><button type="button" className="secondary-command" onClick={() => setEditing(null)}>取消</button><button className="primary-command" disabled={busy}>{busy ? "保存中..." : "保存"}</button></footer></form></aside></div>}</>;
}
