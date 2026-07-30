"use client";

import { Activity, Clock3, RefreshCw, Route, TriangleAlert, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { initialPagination, TablePagination } from "@/components/TablePagination";
import type { PaginationMeta } from "@/lib/pagination";
import { publicPath } from "@/lib/public-path";

interface ObservabilityData {
  totals: Record<string, number>;
  sessions: { items: Array<{ sessionId: string; visitor: string; name: string; runCount: number; createdAt: number | null; updatedAt: number | null }> } & PaginationMeta;
  recentRuns: Array<{ runId: string; sessionId: string; visitor: string; status: string; createdAt: number | null; durationMs: number; inputTokens: number; outputTokens: number; toolCount: number; inputPreview: string }>;
  tools: Array<{ name: string; calls: number; failures: number; confirmations: number }>;
  traces: { items: Array<{ traceId: string; runId: string | null; name: string; status: string; durationMs: number; spanCount: number; startedAt: string }>; total: number };
}

function time(value: number | string | null) {
  if (!value) return "--";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString("zh-CN");
}

export function ObservabilityDashboard() {
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [pagination, setPagination] = useState(() => initialPagination(20));
  const [tab, setTab] = useState<"runs" | "sessions" | "traces" | "tools">("runs");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (page: Pick<PaginationMeta, "page" | "pageSize">, signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page.page), pageSize: String(page.pageSize) });
      const response = await fetch(`${publicPath("/api/observability")}?${params}`, { cache: "no-store", signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "运行数据加载失败");
      setData(body);
      setPagination(body.sessions);
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(loadError instanceof Error ? loadError.message : "运行数据加载失败");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load({ page: pagination.page, pageSize: pagination.pageSize }, controller.signal);
    return () => controller.abort();
  }, [load, pagination.page, pagination.pageSize]);

  const metrics = [
    { label: "累计运行", value: data?.totals.runs, suffix: "", icon: Activity },
    { label: "平均耗时", value: data?.totals.averageDurationMs, suffix: " ms", icon: Clock3 },
    { label: "异常率", value: data?.totals.errorRate, suffix: "%", icon: TriangleAlert },
    { label: "Tool 调用", value: data?.totals.toolCalls, suffix: "", icon: Wrench },
  ];

  return <>
    {error && <p className="inline-error">{error}</p>}
    <section className="metric-band four-columns">{metrics.map(({ label, value, suffix, icon: Icon }) => <div key={label}><Icon size={20} /><span>{label}</span><strong>{value ?? "--"}{value == null ? "" : suffix}</strong></div>)}</section>
    <section className="observability-strip"><div><span>输入 Token</span><strong>{data?.totals.inputTokens ?? "--"}</strong></div><div><span>输出 Token</span><strong>{data?.totals.outputTokens ?? "--"}</strong></div><div><span>模型成本</span><strong>{data ? `$${data.totals.cost.toFixed(6)}` : "--"}</strong></div><div><span>等待确认</span><strong>{data?.totals.paused ?? "--"}</strong></div></section>
    <div className="segmented-control observability-tabs"><button className={tab === "runs" ? "active" : ""} onClick={() => setTab("runs")}><Activity size={16} />运行</button><button className={tab === "sessions" ? "active" : ""} onClick={() => setTab("sessions")}><Route size={16} />会话</button><button className={tab === "traces" ? "active" : ""} onClick={() => setTab("traces")}><Clock3 size={16} />链路</button><button className={tab === "tools" ? "active" : ""} onClick={() => setTab("tools")}><Wrench size={16} />Tools</button><button className="icon-command tab-refresh" onClick={() => void load(pagination)} aria-label="刷新" title="刷新"><RefreshCw className={loading ? "spin" : ""} size={16} /></button></div>
    <section className="section-block table-only">
      <div className="data-table observability-table">
        {loading ? <div className="table-state">正在加载运行数据...</div> : error ? <div className="table-state error">{error}</div> : tab === "runs" ? <><div className="data-row data-head"><span>运行</span><span>状态</span><span>访客</span><span>耗时</span><span>Token</span><span>时间</span></div>{data?.recentRuns.length ? data.recentRuns.map((run) => <div className="data-row" key={run.runId}><span><strong>{run.inputPreview || "无文本输入"}</strong><small>{run.runId.slice(0, 12)} · {run.toolCount} Tools</small></span><span><i className={`state ${run.status === "COMPLETED" ? "success" : run.status === "PAUSED" ? "warning" : "danger"}`}>{run.status}</i></span><span><code>{run.visitor}</code></span><span>{run.durationMs} ms</span><span>{run.inputTokens + run.outputTokens}</span><span>{time(run.createdAt)}</span></div>) : <div className="table-state">暂无运行记录</div>}</> : tab === "sessions" ? <><div className="data-row data-head"><span>会话</span><span>访客</span><span>运行数</span><span>创建时间</span><span>更新时间</span></div>{data?.sessions.items.length ? data.sessions.items.map((session) => <div className="data-row session-observability-row" key={session.sessionId}><span><strong>{session.name}</strong><small>{session.sessionId}</small></span><span><code>{session.visitor}</code></span><span>{session.runCount}</span><span>{time(session.createdAt)}</span><span>{time(session.updatedAt)}</span></div>) : <div className="table-state">暂无会话记录</div>}</> : tab === "traces" ? <><div className="data-row data-head"><span>链路</span><span>状态</span><span>耗时</span><span>Span</span><span>开始时间</span></div>{data?.traces.items.length ? data.traces.items.map((trace) => <div className="data-row trace-row" key={trace.traceId}><span><strong>{trace.name}</strong><small>{trace.traceId}</small></span><span><i className={`state ${trace.status === "OK" ? "success" : "danger"}`}>{trace.status}</i></span><span>{trace.durationMs} ms</span><span>{trace.spanCount}</span><span>{time(trace.startedAt)}</span></div>) : <div className="table-state">暂无 Trace 数据</div>}</> : <><div className="data-row data-head"><span>Tool</span><span>调用</span><span>失败</span><span>需确认</span></div>{data?.tools.length ? data.tools.map((tool) => <div className="data-row tool-stat-row" key={tool.name}><span><code>{tool.name}</code></span><span>{tool.calls}</span><span>{tool.failures}</span><span>{tool.confirmations}</span></div>) : <div className="table-state">暂无 Tool 调用</div>}</>}
      </div>
      {tab === "sessions" && <TablePagination pagination={pagination} loading={loading} onPageChange={(page) => setPagination((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setPagination((current) => ({ ...current, page: 1, pageSize }))} />}
    </section>
  </>;
}
