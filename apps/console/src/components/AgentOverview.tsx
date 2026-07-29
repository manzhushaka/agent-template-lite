"use client";

import { Bot, BrainCircuit, Hammer, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { publicPath } from "@/lib/public-path";

interface Overview { status: string; agent: { id: string; name: string }; model: { name: string; baseUrl: string; configured: boolean }; tools: Array<{ name: string; confirmation: boolean }>; knowledge: { store: string; indexedDocuments: number } }
export function AgentOverview() {
  const [data, setData] = useState<Overview | null>(null); const [error, setError] = useState("");
  async function load() { setError(""); const response = await fetch(publicPath("/api/agent/overview"), { cache: "no-store" }); const body = await response.json(); if (!response.ok) setError(body.message || "AgentOS 不可用"); else setData(body); }
  useEffect(() => { void load(); }, []);
  return <>{error && <p className="inline-error">{error}</p>}<section className="agent-summary"><div><Bot size={21} /><span>智能体</span><strong>{data?.agent.name || "--"}</strong><small>{data?.agent.id || "等待连接"}</small></div><div><BrainCircuit size={21} /><span>真实模型</span><strong>{data?.model.name || "--"}</strong><small>{data?.model.configured ? "API 已配置" : "API 未配置"}</small></div><div><Hammer size={21} /><span>业务 Tools</span><strong>{data?.tools.length ?? "--"}</strong><small>写操作要求人工确认</small></div></section><section className="section-block"><header><div><h2>Tool 装配</h2><p>Agent 只能通过受控 Tool 调用 Console 内部业务 API。</p></div><button className="icon-command" onClick={() => void load()} title="刷新" aria-label="刷新"><RefreshCw size={17} /></button></header><div className="tool-list">{data?.tools.map((tool) => <div key={tool.name}><code>{tool.name}</code><span className={`state ${tool.confirmation ? "warning" : "success"}`}>{tool.confirmation ? "人工确认" : "只读"}</span></div>)}</div></section></>;
}
