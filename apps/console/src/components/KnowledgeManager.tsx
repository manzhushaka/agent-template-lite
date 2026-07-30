"use client";

import { FilePlus2, Globe2, History, RefreshCw, Search, Upload, X } from "lucide-react";
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
  sourceType: "MANUAL" | "FILE" | "WEB";
  status: "DRAFT" | "PUBLISHED";
  version: number;
  indexStatus: "PENDING" | "INDEXING" | "READY" | "ERROR";
  indexError: string | null;
  latestJobId: number | null;
  updatedAt: string;
}

interface VersionItem {
  id: number;
  version: number;
  title: string;
  source: string;
  sourceType: string;
  sourceHash: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
}

interface ChunkItem { chunkId: string; version: number; content: string }
interface IndexJob { id: number; documentId: number | null; targetVersion: number | null; status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED"; attempts: number; requestedBy: string; lastError: string | null; createdAt: string }

const empty: Omit<KnowledgeItem, "id" | "version" | "indexStatus" | "indexError" | "latestJobId" | "updatedAt"> = {
  title: "",
  category: "业务知识",
  content: "",
  source: "业务运营",
  sourceType: "MANUAL",
  status: "DRAFT",
};

export function KnowledgeManager() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [pagination, setPagination] = useState(() => initialPagination());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Partial<KnowledgeItem> | null>(null);
  const [importing, setImporting] = useState(false);
  const [importType, setImportType] = useState<"FILE" | "WEB">("FILE");
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [jobs, setJobs] = useState<IndexJob[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (page: Pick<PaginationMeta, "page" | "pageSize">, search: string, signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page.page), pageSize: String(page.pageSize) });
    if (search.trim()) params.set("q", search.trim());
    try {
      const response = await fetch(`${publicPath("/api/knowledge")}?${params}`, { cache: "no-store", signal });
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
  }, []);

  const loadJobs = useCallback(async () => {
    const response = await fetch(publicPath("/api/knowledge/jobs"), { cache: "no-store" });
    if (response.ok) setJobs((await response.json()).items || []);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load({ page: pagination.page, pageSize: pagination.pageSize }, query, controller.signal), query ? 250 : 0);
    void loadJobs();
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, loadJobs, pagination.page, pagination.pageSize, query]);

  useEffect(() => {
    if (!jobs.some((job) => job.status === "PENDING" || job.status === "RUNNING")) return;
    const timer = window.setInterval(() => {
      void Promise.all([load(pagination, query), loadJobs()]);
    }, 2_500);
    return () => window.clearInterval(timer);
  }, [jobs, load, loadJobs, pagination, query]);

  async function runIndexJob(jobId: number) {
    const response = await fetch(publicPath(`/api/knowledge/jobs/${jobId}`), { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || "索引任务失败");
    return body.message || "索引已更新";
  }

  async function processAndRefresh(jobId: number) {
    try {
      setMessage(await runIndexJob(jobId));
    } catch (jobError) {
      setMessage(jobError instanceof Error ? jobError.message : "索引任务失败");
    } finally {
      await Promise.all([load(pagination, query), loadJobs()]);
    }
  }

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
      if (!response.ok) throw new Error(body.message || "保存失败");
      setEditing(null);
      setMessage(body.message || "知识已保存");
      await load(editing?.id ? pagination : { ...pagination, page: 1 }, query);
      await loadJobs();
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function importKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const body = new FormData(event.currentTarget);
    body.set("sourceType", importType);
    try {
      const response = await fetch(publicPath("/api/knowledge/import"), { method: "POST", body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "导入失败");
      setImporting(false);
      setMessage(result.message || "知识已导入");
      setPagination((current) => ({ ...current, page: 1 }));
      await loadJobs();
    } catch (importError) {
      setMessage(importError instanceof Error ? importError.message : "导入失败");
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
      if (!response.ok) throw new Error(body.message || "索引任务创建失败");
      setMessage(body.message);
      await loadJobs();
    } catch (reindexError) {
      setMessage(reindexError instanceof Error ? reindexError.message : "索引请求失败");
    } finally {
      setBusy(false);
    }
  }

  async function openDocument(item: KnowledgeItem) {
    setEditing(item);
    setVersions([]);
    setChunks([]);
    const [versionResponse, chunkResponse] = await Promise.all([
      fetch(publicPath(`/api/knowledge/${item.id}/versions`), { cache: "no-store" }),
      item.indexStatus === "READY"
        ? fetch(publicPath(`/api/knowledge/${item.id}/chunks`), { cache: "no-store" })
        : Promise.resolve(null),
    ]);
    if (versionResponse.ok) setVersions((await versionResponse.json()).items || []);
    if (chunkResponse?.ok) setChunks((await chunkResponse.json()).items || []);
  }

  return (
    <>
      <form className="filter-bar" onSubmit={(event) => event.preventDefault()}>
        <label><Search size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} placeholder="搜索标题、分类或来源" /></label>
        <button type="button" className="secondary-command" onClick={() => void reindex()} disabled={busy}><RefreshCw className={busy ? "spin" : ""} size={16} />重建索引</button>
        <button type="button" className="secondary-command" onClick={() => setImporting(true)}><Upload size={16} />导入</button>
        <button type="button" className="primary-command" onClick={() => setEditing(empty)}><FilePlus2 size={17} />新增知识</button>
      </form>
      <section className="section-block table-only">
        <div className="data-table knowledge-table">
          <div className="data-row data-head"><span>知识</span><span>来源</span><span>版本</span><span>发布</span><span>索引</span><span>更新时间</span></div>
          {loading ? <div className="table-state">正在加载知识...</div> : error ? <div className="table-state error">{error}</div> : items.length === 0 ? <div className="table-state">暂无符合条件的知识文档</div> : items.map((item) => (
            <button className="data-row editable-row" key={item.id} onClick={() => void openDocument(item)}>
              <span><strong>{item.title}</strong><small>{item.category}</small></span>
              <span><i className="state neutral">{item.sourceType}</i><small>{item.source}</small></span>
              <span>v{item.version}</span>
              <span><i className={`state ${item.status === "PUBLISHED" ? "success" : "neutral"}`}>{item.status}</i></span>
              <span><i className={`state ${item.indexStatus === "READY" ? "success" : item.indexStatus === "ERROR" ? "danger" : "warning"}`}>{item.indexStatus}</i></span>
              <span>{new Date(item.updatedAt).toLocaleString("zh-CN")}</span>
            </button>
          ))}
        </div>
        <TablePagination pagination={pagination} loading={loading} onPageChange={(page) => setPagination((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => setPagination((current) => ({ ...current, page: 1, pageSize }))} />
      </section>
      <section className="section-block"><header><div><h2>最近索引任务</h2><p>任务状态持久化保存，失败任务可以显式重试。</p></div></header><div className="table-only"><div className="data-table index-job-table"><div className="data-row data-head"><span>任务</span><span>文档</span><span>状态</span><span>次数</span><span>发起人</span><span>创建时间</span><span>操作</span></div>{jobs.length ? jobs.map((job) => <div className="data-row" key={job.id}><span><strong>#{job.id}</strong><small>{job.targetVersion ? `目标 v${job.targetVersion}` : "全量重建"}</small></span><span>{job.documentId || "全部"}</span><span><i className={`state ${job.status === "SUCCEEDED" ? "success" : job.status === "FAILED" ? "danger" : "warning"}`}>{job.status}</i></span><span>{job.attempts}</span><span>{job.requestedBy}</span><span>{new Date(job.createdAt).toLocaleString("zh-CN")}</span><span>{job.status === "FAILED" ? <button className="icon-command" type="button" onClick={() => void processAndRefresh(job.id)} aria-label={`重试索引任务 ${job.id}`} title={job.lastError || "重试"}><RefreshCw size={15} /></button> : "--"}</span></div>) : <div className="table-state">暂无索引任务</div>}</div></div></section>
      {message && <p className="toast-message">{message}</p>}

      {editing && <div className="drawer-layer"><button className="drawer-scrim" onClick={() => setEditing(null)} aria-label="关闭" /><aside className="drawer wide-drawer" role="dialog" aria-modal="true"><header><div><small>KNOWLEDGE DOCUMENT</small><h2>{editing.id ? "编辑知识" : "新增知识"}</h2></div><button className="icon-command" onClick={() => setEditing(null)} aria-label="关闭"><X size={18} /></button></header>
        {editing.indexError && <div className="operation-alert"><strong>索引失败</strong><p>{editing.indexError}</p>{editing.latestJobId && <button type="button" className="secondary-command" onClick={() => void processAndRefresh(editing.latestJobId!)}><RefreshCw size={15} />重试</button>}</div>}
        <form onSubmit={save}><div className="form-grid"><label className="full"><span>标题</span><input name="title" defaultValue={editing.title} required /></label><label><span>分类</span><input name="category" defaultValue={editing.category} required /></label><label><span>来源</span><input name="source" defaultValue={editing.source} required /></label><label><span>状态</span><select name="status" defaultValue={editing.status}><option value="DRAFT">草稿</option><option value="PUBLISHED">发布</option></select></label><label className="full"><span>正文</span><textarea name="content" defaultValue={editing.content} rows={14} required /></label></div><footer><button type="button" className="secondary-command" onClick={() => setEditing(null)}>取消</button><button className="primary-command" disabled={busy}>{busy ? "保存中..." : "保存并创建索引任务"}</button></footer></form>
        {editing.id && <section className="drawer-section"><header><History size={17} /><h3>版本记录</h3></header>{versions.length ? versions.map((version) => <div className="detail-row" key={version.id}><span>v{version.version} · {version.status}</span><strong>{version.createdBy}</strong><small>{new Date(version.createdAt).toLocaleString("zh-CN")}</small></div>) : <p className="empty-copy">暂无版本记录</p>}</section>}
        {editing.id && <section className="drawer-section"><header><Globe2 size={17} /><h3>索引切片</h3></header>{chunks.length ? chunks.map((chunk) => <div className="chunk-preview" key={chunk.chunkId}><code>{chunk.chunkId}</code><p>{chunk.content}</p></div>) : <p className="empty-copy">索引成功后可查看切片</p>}</section>}
      </aside></div>}

      {importing && <div className="drawer-layer"><button className="drawer-scrim" onClick={() => setImporting(false)} aria-label="关闭" /><aside className="drawer" role="dialog" aria-modal="true"><header><div><small>KNOWLEDGE IMPORT</small><h2>导入知识</h2></div><button className="icon-command" onClick={() => setImporting(false)} aria-label="关闭"><X size={18} /></button></header><div className="segmented-control"><button type="button" className={importType === "FILE" ? "active" : ""} onClick={() => setImportType("FILE")}><Upload size={16} />文件</button><button type="button" className={importType === "WEB" ? "active" : ""} onClick={() => setImportType("WEB")}><Globe2 size={16} />网页</button></div><form onSubmit={importKnowledge}><div className="form-grid"><label className="full"><span>标题（可选）</span><input name="title" maxLength={200} /></label><label><span>分类</span><input name="category" defaultValue="业务知识" required /></label><label><span>状态</span><select name="status" defaultValue="DRAFT"><option value="DRAFT">草稿</option><option value="PUBLISHED">发布</option></select></label>{importType === "FILE" ? <label className="full"><span>文件</span><input name="file" type="file" accept=".pdf,.html,.htm,.md,.txt,application/pdf,text/html,text/markdown,text/plain" required /></label> : <label className="full"><span>网页地址</span><input name="url" type="url" placeholder="https://example.com/knowledge" required /></label>}</div><footer><button type="button" className="secondary-command" onClick={() => setImporting(false)}>取消</button><button className="primary-command" disabled={busy}>{busy ? "导入中..." : "导入并创建索引任务"}</button></footer></form></aside></div>}
    </>
  );
}
