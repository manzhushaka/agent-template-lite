"use client";

import { BookOpenText, Boxes, ClipboardList, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { publicPath } from "@/lib/public-path";

type Data = { metrics: { products: number; orders: number; knowledge: number }; recent: Array<{ id: number; actor: string; action: string; resourceType: string; createdAt: string }> };
export function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  async function load() { setError(""); const response = await fetch(publicPath("/api/dashboard"), { cache: "no-store" }); const body = await response.json(); if (!response.ok) setError(body.message || "加载失败"); else setData(body); }
  useEffect(() => { void load(); }, []);
  const metrics = [{ key: "products", label: "演示商品", icon: Boxes }, { key: "orders", label: "演示订单", icon: ClipboardList }, { key: "knowledge", label: "知识文档", icon: BookOpenText }] as const;
  return <><section className="metric-band">{metrics.map(({ key, label, icon: Icon }) => <div key={key}><Icon size={20} /><span>{label}</span><strong>{data?.metrics[key] ?? "--"}</strong></div>)}</section><section className="section-block"><header><div><h2>最近操作</h2><p>记录控制台和 Agent 内部业务写入。</p></div><button className="icon-command" onClick={() => void load()} title="刷新" aria-label="刷新"><RefreshCw size={17} /></button></header>{error ? <p className="inline-error">{error}</p> : <div className="data-table"><div className="data-row data-head"><span>操作者</span><span>操作</span><span>资源</span><span>时间</span></div>{data?.recent.map((item) => <div className="data-row" key={item.id}><span>{item.actor}</span><span>{item.action}</span><span>{item.resourceType}</span><span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span></div>)}</div>}</section></>;
}
