"use client";

import { FilePlus2, RefreshCw, Search, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { initialPagination, TablePagination } from "@/components/TablePagination";
import type { PaginationMeta } from "@/lib/pagination";
import { publicPath } from "@/lib/public-path";

interface KnowledgeItem {
  id: number;
  title: string;
  category: string;
  content: string;
  source: string;
  status: "DRAFT" | "PUBLISHED";
  version: number;
  indexStatus: string;
  updatedAt: string;
}

const empty: Omit<KnowledgeItem, "id" | "version" | "indexStatus" | "updatedAt"> = {
  title: "",
  category: "业务知识",
  content: "",
  source: "业务运营",
  status: "DRAFT",
};

export function KnowledgeManager() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [pagination, setPagination] = useState(() => initialPagination());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Partial<KnowledgeItem> | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (page: Pick<PaginationMeta, "page" | "pageSize">, search: string, signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: String(page.page),
        pageSize: String(page.pageSize),
      });
      if (search.trim()) params.set("q", search.trim());
      try {
        const response = await fetch(`${publicPath("/api/knowledge")}?${params}`, {
          cache: "no-store",
          signal,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || "知识加载失败");
        setItems(Array.isArray(body.items) ? body.items : []);
        setPagination(body.pagination);
      } catch (loadError) {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError(loadError instanceof Error ? loadError.message : "知识加载失败");
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => void load(
        { page: pagination.page, pageSize: pagination.pageSize },
        query,
        controller.signal,
      ),
      query ? 250 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load, pagination.page, pagination.pageSize, query]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const payload = { ...Object.fromEntries(new FormData(event.currentTarget)), id: editing?.id };
    try {
      const response = await fetch(publicPath("/api/knowledge"), {
        method: editing?.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(body.message || "保存失败");
        return;
      }
      const targetPage = editing?.id ? pagination.page : 1;
      setEditing(null);
      setMessage(body.indexing?.message || "知识已保存");
      if (targetPage === pagination.page) {
        await load(pagination, query);
      } else {
        setPagination((current) => ({ ...current, page: targetPage }));
      }
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function reindex() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(publicPath("/api/knowledge"), { method: "PATCH" });
      const body = await response.json().catch(() => ({}));
      setMessage(body.indexing?.message || body.message || "索引请求已完成");
      await load(pagination, query);
    } catch (reindexError) {
      setMessage(reindexError instanceof Error ? reindexError.message : "索引请求失败");
    } finally {
      setBusy(false);
    }
  }

  function changePage(page: number) {
    setPagination((current) => ({ ...current, page }));
  }

  function changePageSize(pageSize: number) {
    setPagination((current) => ({ ...current, page: 1, pageSize }));
  }

  return (
    <>
      <form className="filter-bar" onSubmit={(event) => event.preventDefault()}>
        <label>
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              changePage(1);
            }}
            placeholder="搜索标题、分类或来源"
          />
        </label>
        <button type="button" className="secondary-command" onClick={() => void reindex()} disabled={busy}>
          <RefreshCw className={busy ? "spin" : ""} size={16} />重建索引
        </button>
        <button type="button" className="primary-command" onClick={() => setEditing(empty)}>
          <FilePlus2 size={17} />新增知识
        </button>
      </form>
      <section className="section-block table-only">
        <div className="data-table knowledge-table">
          <div className="data-row data-head"><span>知识</span><span>分类</span><span>版本</span><span>发布</span><span>索引</span><span>更新时间</span></div>
          {loading ? <div className="table-state">正在加载知识...</div> : error ? <div className="table-state error">{error}</div> : items.length === 0 ? <div className="table-state">暂无符合条件的知识文档</div> : items.map((item) => (
            <button className="data-row editable-row" key={item.id} onClick={() => setEditing(item)}>
              <span><strong>{item.title}</strong><small>{item.source}</small></span>
              <span>{item.category}</span><span>v{item.version}</span>
              <span><i className={`state ${item.status === "PUBLISHED" ? "success" : "neutral"}`}>{item.status}</i></span>
              <span><i className={`state ${item.indexStatus === "READY" ? "success" : "warning"}`}>{item.indexStatus}</i></span>
              <span>{new Date(item.updatedAt).toLocaleString("zh-CN")}</span>
            </button>
          ))}
        </div>
        <TablePagination pagination={pagination} loading={loading} onPageChange={changePage} onPageSizeChange={changePageSize} />
      </section>
      {message && <p className="toast-message">{message}</p>}
      {editing && (
        <div className="drawer-layer">
          <button className="drawer-scrim" onClick={() => setEditing(null)} aria-label="关闭" />
          <aside className="drawer" role="dialog" aria-modal="true">
            <header>
              <div><small>KNOWLEDGE DOCUMENT</small><h2>{editing.id ? "编辑知识" : "新增知识"}</h2></div>
              <button className="icon-command" onClick={() => setEditing(null)} aria-label="关闭"><X size={18} /></button>
            </header>
            <form onSubmit={save}>
              <div className="form-grid">
                <label className="full"><span>标题</span><input name="title" defaultValue={editing.title} required /></label>
                <label><span>分类</span><input name="category" defaultValue={editing.category} required /></label>
                <label><span>来源</span><input name="source" defaultValue={editing.source} required /></label>
                <label><span>状态</span><select name="status" defaultValue={editing.status}><option value="DRAFT">草稿</option><option value="PUBLISHED">发布</option></select></label>
                <label className="full"><span>正文</span><textarea name="content" defaultValue={editing.content} rows={16} required /></label>
              </div>
              {message && <p className="form-error">{message}</p>}
              <footer>
                <button type="button" className="secondary-command" onClick={() => setEditing(null)}>取消</button>
                <button className="primary-command" disabled={busy}>{busy ? "保存中..." : "保存"}</button>
              </footer>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
