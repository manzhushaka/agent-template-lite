"use client";

import { Bug, CircleAlert, Info, Pause, Play, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { publicPath } from "@/lib/public-path";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
type LogSource = "chat" | "console" | "agentos" | "system";

interface LogEntry {
  id: string;
  timestamp: string | null;
  level: LogLevel;
  source: LogSource;
  message: string;
}

interface LogResponse {
  items: LogEntry[];
  counts: Record<LogLevel, number>;
  matched: number;
  scanned: number;
  limit: number;
  truncated: boolean;
  available: boolean;
  updatedAt: string | null;
}

const levels: Array<{ value: "ALL" | LogLevel; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "DEBUG", label: "Debug" },
  { value: "INFO", label: "Info" },
  { value: "WARN", label: "Warn" },
  { value: "ERROR", label: "Error" },
];

function formatTime(value: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString("zh-CN", { hour12: false });
}

export function ApplicationLogViewer() {
  const [data, setData] = useState<LogResponse | null>(null);
  const [level, setLevel] = useState<"ALL" | LogLevel>("ALL");
  const [source, setSource] = useState<"ALL" | LogSource>("ALL");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(300);
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal, quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: String(limit) });
    if (level !== "ALL") params.set("level", level);
    if (source !== "ALL") params.set("source", source);
    if (query.trim()) params.set("q", query.trim());
    try {
      const response = await fetch(`${publicPath("/api/logs")}?${params}`, { cache: "no-store", signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "应用日志加载失败");
      setData(body);
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
        setError(loadError instanceof Error ? loadError.message : "应用日志加载失败");
      }
    } finally {
      if (!signal?.aborted && !quiet) setLoading(false);
    }
  }, [level, limit, query, source]);

  useEffect(() => {
    const controller = new AbortController();
    const debounce = window.setTimeout(() => void load(controller.signal), query ? 250 : 0);
    const timer = live ? window.setInterval(() => void load(undefined, true), 2500) : undefined;
    return () => {
      controller.abort();
      window.clearTimeout(debounce);
      if (timer) window.clearInterval(timer);
    };
  }, [live, load, query]);

  const metrics = [
    { label: "DEBUG", value: data?.counts.DEBUG ?? 0, icon: Bug, level: "debug" },
    { label: "INFO", value: data?.counts.INFO ?? 0, icon: Info, level: "info" },
    { label: "WARN", value: data?.counts.WARN ?? 0, icon: TriangleAlert, level: "warn" },
    { label: "ERROR", value: data?.counts.ERROR ?? 0, icon: CircleAlert, level: "error" },
  ];

  return <>
    <section className="log-metrics" aria-label="当前日志窗口级别统计">
      {metrics.map(({ label, value, icon: Icon, level: metricLevel }) => <div key={label} className={`log-metric ${metricLevel}`}><Icon size={17} /><span>{label}</span><strong>{value}</strong></div>)}
    </section>
    <div className="segmented-control log-level-tabs" aria-label="日志级别">
      {levels.map((item) => <button type="button" key={item.value} className={level === item.value ? "active" : ""} aria-pressed={level === item.value} onClick={() => setLevel(item.value)}>{item.label}</button>)}
    </div>
    <form className="log-filter-bar" onSubmit={(event) => event.preventDefault()}>
      <label className="log-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索日志内容" aria-label="搜索日志内容" /></label>
      <select value={source} onChange={(event) => setSource(event.target.value as "ALL" | LogSource)} aria-label="运行时">
        <option value="ALL">全部运行时</option><option value="chat">Chat</option><option value="console">Console</option><option value="agentos">AgentOS</option><option value="system">System</option>
      </select>
      <select value={limit} onChange={(event) => setLimit(Number(event.target.value))} aria-label="显示条数">
        <option value={100}>最近 100 条</option><option value={300}>最近 300 条</option><option value={500}>最近 500 条</option>
      </select>
      <button type="button" className={live ? "icon-command live-command" : "icon-command"} onClick={() => setLive((current) => !current)} aria-label={live ? "暂停自动刷新" : "继续自动刷新"} title={live ? "暂停自动刷新" : "继续自动刷新"}>{live ? <Pause size={16} /> : <Play size={16} />}</button>
      <button type="button" className="icon-command" onClick={() => void load()} aria-label="刷新" title="刷新"><RefreshCw className={loading ? "spin" : ""} size={16} /></button>
    </form>
    <section className="log-console" aria-label="应用日志">
      <header><div><i className={live ? "online" : "paused"} /><strong>{live ? "在线" : "已暂停"}</strong><span>{data ? `匹配 ${data.matched} / 扫描 ${data.scanned}` : "等待日志"}</span></div><time>{data?.updatedAt ? `文件更新于 ${formatTime(data.updatedAt)}` : ""}</time></header>
      <div className="log-stream" aria-live="polite">
        {loading ? <div className="log-state">正在读取应用日志...</div> : error ? <div className="log-state error">{error}</div> : !data?.available ? <div className="log-state"><strong>日志文件尚未生成</strong><span>使用 pnpm dev 或 pnpm start 启动完整服务后，日志会自动出现在这里。</span></div> : data.items.length ? data.items.map((entry) => <article className="log-row" key={entry.id}><time>{formatTime(entry.timestamp)}</time><span className={`log-level ${entry.level.toLowerCase()}`}>{entry.level}</span><span className="log-source">{entry.source}</span><pre>{entry.message}</pre></article>) : <div className="log-state">当前筛选条件下没有日志</div>}
      </div>
      <footer><span>每 2.5 秒自动刷新</span>{data?.truncated && <span>仅展示受限日志窗口中的最新结果</span>}</footer>
    </section>
  </>;
}
