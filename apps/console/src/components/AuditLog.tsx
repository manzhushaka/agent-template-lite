"use client";

import { RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { initialPagination, TablePagination } from "@/components/TablePagination";
import type { PaginationMeta } from "@/lib/pagination";
import { publicPath } from "@/lib/public-path";

interface AuditItem { id: number; actor: string; action: string; resourceType: string; resourceId: string | null; detail: unknown; createdAt: string }

export function AuditLog() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [pagination, setPagination] = useState(() => initialPagination(20));
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async (page: Pick<PaginationMeta, "page" | "pageSize">, search: string, signal?: AbortSignal) => {
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page.page), pageSize: String(page.pageSize) });
    if (search.trim()) params.set("q", search.trim());
    try {
      const response = await fetch(`${publicPath("/api/audit")}?${params}`, { cache: "no-store", signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "审计日志加载失败");
      setItems(body.items || []); setPagination(body.pagination);
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) setError(loadError instanceof Error ? loadError.message : "审计日志加载失败");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => void load({ page: pagination.page, pageSize: pagination.pageSize }, query, controller.signal), query ? 250 : 0); return () => { clearTimeout(timer); controller.abort(); }; }, [load, pagination.page, pagination.pageSize, query]);
  return <><form className="filter-bar" onSubmit={(event) => event.preventDefault()}><label><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} placeholder="搜索操作者、动作或资源" /></label><button type="button" className="icon-command" onClick={() => void load(pagination, query)} aria-label="刷新" title="刷新"><RefreshCw className={loading ? "spin" : ""} size={16} /></button></form><section className="section-block table-only"><div className="data-table audit-table"><div className="data-row data-head"><span>操作者</span><span>动作</span><span>资源</span><span>资源 ID</span><span>时间</span></div>{loading ? <div className="table-state">正在加载审计日志...</div> : error ? <div className="table-state error">{error}</div> : items.length ? items.map((item) => <div className="data-row" key={item.id}><span><strong>{item.actor}</strong></span><span><code>{item.action}</code></span><span>{item.resourceType}</span><span>{item.resourceId || "--"}</span><span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span></div>) : <div className="table-state">暂无审计日志</div>}</div><TablePagination pagination={pagination} loading={loading} onPageChange={(page) => setPagination((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setPagination((current) => ({ ...current, page: 1, pageSize }))} /></section></>;
}
