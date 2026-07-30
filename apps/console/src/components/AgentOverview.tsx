"use client";

import { Bot, BrainCircuit, Hammer, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { publicPath } from "@/lib/public-path";

interface Overview { status: string; agent: { id: string; name: string }; model: { name: string; baseUrl: string; configured: boolean }; tools: Array<{ name: string; confirmation: boolean }>; knowledge: { store: string; indexedDocuments: number } }
export function AgentOverview() {
  const [data, setData] = useState<Overview | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(publicPath("/api/agent/overview"), { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "AgentOS 不可用");
      setData(body);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "AgentOS 不可用");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);
  return <>{error && <p className="inline-error">{error}</p>}<section className="agent-summary"><div><Bot size={21} /><span>智能体</span><strong>{data?.agent.name || "--"}</strong><small>{data?.agent.id || (loading ? "正在连接" : "连接不可用")}</small></div><div><BrainCircuit size={21} /><span>真实模型</span><strong>{data?.model.name || "--"}</strong><small>{loading ? "正在加载" : data?.model.configured ? "API 已配置" : "API 未配置"}</small></div><div><Hammer size={21} /><span>业务 Tools</span><strong>{data?.tools.length ?? "--"}</strong><small>写操作要求人工确认</small></div></section><section className="section-block"><header><div><h2>Tool 装配</h2><p>Agent 只能通过受控 Tool 调用 Console 内部业务 API。</p></div><button className="icon-command" onClick={() => void load()} title="刷新" aria-label="刷新" disabled={loading}><RefreshCw className={loading ? "spin" : ""} size={17} /></button></header><div className="tool-list">{loading ? <div className="table-state">正在加载 Tool 配置...</div> : data?.tools.length ? data.tools.map((tool) => <div key={tool.name}><code>{tool.name}</code><span className={`state ${tool.confirmation ? "warning" : "success"}`}>{tool.confirmation ? "人工确认" : "只读"}</span></div>) : <div className="table-state">暂无 Tool 配置</div>}</div></section></>;
}
