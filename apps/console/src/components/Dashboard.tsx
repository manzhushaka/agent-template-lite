"use client";

import { BookOpenText, Boxes, ClipboardList, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { initialPagination, TablePagination } from "@/components/TablePagination";
import type { PaginationMeta } from "@/lib/pagination";
import { publicPath } from "@/lib/public-path";

interface AuditItem {
  id: number;
  actor: string;
  action: string;
  resourceType: string;
  createdAt: string;
}

interface DashboardData {
  metrics: { products: number; orders: number; knowledge: number };
  recent: { items: AuditItem[]; pagination: PaginationMeta };
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [pagination, setPagination] = useState(() => initialPagination());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (page: Pick<PaginationMeta, "page" | "pageSize">, signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: String(page.page),
        pageSize: String(page.pageSize),
      });
      try {
        const response = await fetch(`${publicPath("/api/dashboard")}?${params}`, {
          cache: "no-store",
          signal,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || "加载失败");
        setData(body);
        setPagination(body.recent.pagination);
      } catch (loadError) {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(loadError instanceof Error ? loadError.message : "加载失败");
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(
      { page: pagination.page, pageSize: pagination.pageSize },
      controller.signal,
    );
    return () => controller.abort();
  }, [load, pagination.page, pagination.pageSize]);

  const metrics = [
    { key: "products", label: "演示商品", icon: Boxes },
    { key: "orders", label: "演示订单", icon: ClipboardList },
    { key: "knowledge", label: "知识文档", icon: BookOpenText },
  ] as const;

  return (
    <>
      <section className="metric-band">
        {metrics.map(({ key, label, icon: Icon }) => (
          <div key={key}><Icon size={20} /><span>{label}</span><strong>{data?.metrics[key] ?? "--"}</strong></div>
        ))}
      </section>
      <section className="section-block">
        <header>
          <div><h2>最近操作</h2><p>按时间倒序记录控制台和 Agent 内部业务写入。</p></div>
          <button className="icon-command" onClick={() => void load(pagination)} title="刷新" aria-label="刷新">
            <RefreshCw className={loading ? "spin" : ""} size={17} />
          </button>
        </header>
        <div className="table-only">
          <div className="data-table">
            <div className="data-row data-head"><span>操作者</span><span>操作</span><span>资源</span><span>时间</span></div>
            {loading ? <div className="table-state">正在加载操作记录...</div> : error ? <div className="table-state error">{error}</div> : !data?.recent.items.length ? <div className="table-state">暂无操作记录</div> : data.recent.items.map((item) => (
              <div className="data-row" key={item.id}>
                <span>{item.actor}</span><span>{item.action}</span><span>{item.resourceType}</span>
                <span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span>
              </div>
            ))}
          </div>
          <TablePagination
            pagination={pagination}
            loading={loading}
            onPageChange={(page) => setPagination((current) => ({ ...current, page }))}
            onPageSizeChange={(pageSize) => setPagination((current) => ({ ...current, page: 1, pageSize }))}
          />
        </div>
      </section>
    </>
  );
}
