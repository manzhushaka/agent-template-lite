"use client";

import { Boxes, ClipboardList, Plus, RefreshCw, Search, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type { DemoOrder, DemoProduct } from "@template/shared";
import { initialPagination, TablePagination } from "@/components/TablePagination";
import type { PaginationMeta } from "@/lib/pagination";
import { publicPath } from "@/lib/public-path";
import { demoResourceSpecs } from "@/lib/resource-specs";

const emptyProduct: Omit<DemoProduct, "id" | "updatedAt"> = {
  sku: "",
  name: "",
  description: "",
  priceCents: 100,
  stock: 10,
  status: "DRAFT",
  imageUrl: "",
};

/**
 * Sample CRUD surface. EXTENSION: Reuse the filter/table/drawer interaction for another simple
 * resource, but move domain rules into a server-side service and validate every Route Handler.
 */
export function DemoCenter() {
  const [tab, setTab] = useState<"products" | "orders">("products");
  const [products, setProducts] = useState<DemoProduct[]>([]);
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [productPagination, setProductPagination] = useState(() => initialPagination());
  const [orderPagination, setOrderPagination] = useState(() => initialPagination());
  const [productsLoading, setProductsLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [productError, setProductError] = useState("");
  const [orderError, setOrderError] = useState("");
  const [editing, setEditing] = useState<Partial<DemoProduct> | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const spec = demoResourceSpecs.products;

  const loadProducts = useCallback(
    async (pagination: Pick<PaginationMeta, "page" | "pageSize">, search: string, signal?: AbortSignal) => {
      setProductsLoading(true);
      setProductError("");
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });
      if (search.trim()) params.set("q", search.trim());
      try {
        const response = await fetch(`${publicPath("/api/demo/products")}?${params}`, {
          cache: "no-store",
          signal,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || "商品加载失败");
        setProducts(Array.isArray(body.items) ? body.items : []);
        setProductPagination(body.pagination);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setProductError(error instanceof Error ? error.message : "商品加载失败");
        }
      } finally {
        if (!signal?.aborted) setProductsLoading(false);
      }
    },
    [],
  );

  const loadOrders = useCallback(
    async (pagination: Pick<PaginationMeta, "page" | "pageSize">, signal?: AbortSignal) => {
      setOrdersLoading(true);
      setOrderError("");
      const params = new URLSearchParams({
        page: String(pagination.page),
        pageSize: String(pagination.pageSize),
      });
      try {
        const response = await fetch(`${publicPath("/api/demo/orders")}?${params}`, {
          cache: "no-store",
          signal,
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message || "订单加载失败");
        setOrders(Array.isArray(body.items) ? body.items : []);
        setOrderPagination(body.pagination);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setOrderError(error instanceof Error ? error.message : "订单加载失败");
        }
      } finally {
        if (!signal?.aborted) setOrdersLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(
      () => void loadProducts(
        { page: productPagination.page, pageSize: productPagination.pageSize },
        query,
        controller.signal,
      ),
      query ? 250 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadProducts, productPagination.page, productPagination.pageSize, query]);

  useEffect(() => {
    const controller = new AbortController();
    void loadOrders(
      { page: orderPagination.page, pageSize: orderPagination.pageSize },
      controller.signal,
    );
    return () => controller.abort();
  }, [loadOrders, orderPagination.page, orderPagination.pageSize]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const payload = {
      ...values,
      id: editing?.id,
      priceCents: Number(values.priceCents),
      stock: Number(values.stock),
    };
    try {
      const response = await fetch(publicPath("/api/demo/products"), {
        method: editing?.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(body.message || "保存失败");
        return;
      }
      const targetPage = editing?.id ? productPagination.page : 1;
      setEditing(null);
      setMessage("商品已保存");
      if (targetPage === productPagination.page) {
        await loadProducts(productPagination, query);
      } else {
        setProductPagination((current) => ({ ...current, page: targetPage }));
      }
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  function changeProductPage(page: number) {
    setProductPagination((current) => ({ ...current, page }));
  }

  function changeProductPageSize(pageSize: number) {
    setProductPagination((current) => ({ ...current, page: 1, pageSize }));
  }

  function changeOrderPage(page: number) {
    setOrderPagination((current) => ({ ...current, page }));
  }

  function changeOrderPageSize(pageSize: number) {
    setOrderPagination((current) => ({ ...current, page: 1, pageSize }));
  }

  return (
    <>
      <div className="segmented-control">
        <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>
          <Boxes size={16} />商品数据
        </button>
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>
          <ClipboardList size={16} />订单记录
        </button>
      </div>
      {tab === "products" ? (
        <>
          <form className="filter-bar" onSubmit={(event) => event.preventDefault()}>
            <label>
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  changeProductPage(1);
                }}
                placeholder="搜索 SKU、名称或说明"
              />
            </label>
            <button
              type="button"
              className="icon-command"
              onClick={() => void loadProducts(productPagination, query)}
              title="刷新"
              aria-label="刷新"
            >
              <RefreshCw className={productsLoading ? "spin" : ""} size={17} />
            </button>
            <button type="button" className="primary-command" onClick={() => setEditing(emptyProduct)}>
              <Plus size={17} />新增商品
            </button>
          </form>
          <section className="section-block table-only">
            <div className="data-table product-table">
              <div className="data-row data-head"><span>商品</span><span>价格</span><span>库存</span><span>状态</span><span>更新时间</span></div>
              {productsLoading ? <div className="table-state">正在加载商品...</div> : productError ? <div className="table-state error">{productError}</div> : products.length === 0 ? <div className="table-state">暂无符合条件的商品</div> : products.map((item) => (
                <button className="data-row editable-row" key={item.id} onClick={() => setEditing(item)}>
                  <span><strong>{item.name}</strong><small>{item.sku}</small></span>
                  <span>¥{(item.priceCents / 100).toFixed(2)}</span>
                  <span>{item.stock}</span>
                  <span><i className={`state ${item.status === "ON_SALE" ? "success" : "neutral"}`}>{item.status}</i></span>
                  <span>{new Date(item.updatedAt).toLocaleString("zh-CN")}</span>
                </button>
              ))}
            </div>
            <TablePagination pagination={productPagination} loading={productsLoading} onPageChange={changeProductPage} onPageSizeChange={changeProductPageSize} />
          </section>
        </>
      ) : (
        <section className="section-block table-only">
          <div className="data-table order-table">
            <div className="data-row data-head"><span>订单号</span><span>商品</span><span>数量</span><span>金额</span><span>状态</span><span>创建时间</span></div>
            {ordersLoading ? <div className="table-state">正在加载订单...</div> : orderError ? <div className="table-state error">{orderError}</div> : orders.length === 0 ? <div className="table-state">暂无订单记录</div> : orders.map((item) => (
              <div className="data-row" key={item.id}>
                <span>{item.orderNo}</span><span>{item.productName}</span><span>{item.quantity}</span>
                <span>¥{(item.amountCents / 100).toFixed(2)}</span>
                <span><i className="state success">{item.status}</i></span>
                <span>{new Date(item.createdAt).toLocaleString("zh-CN")}</span>
              </div>
            ))}
          </div>
          <TablePagination pagination={orderPagination} loading={ordersLoading} onPageChange={changeOrderPage} onPageSizeChange={changeOrderPageSize} />
        </section>
      )}
      {message && <p className="toast-message">{message}</p>}
      {editing && (
        <div className="drawer-layer">
          <button className="drawer-scrim" onClick={() => setEditing(null)} aria-label="关闭" />
          <aside className="drawer" role="dialog" aria-modal="true">
            <header>
              <div><small>DEMO RESOURCE</small><h2>{editing.id ? "编辑商品" : "新增商品"}</h2></div>
              <button className="icon-command" onClick={() => setEditing(null)} aria-label="关闭"><X size={18} /></button>
            </header>
            <form onSubmit={save}>
              <div className="form-grid">
                {spec.fields.map((field) => (
                  <label className={field.type === "textarea" || field.type === "url" ? "full" : ""} key={field.key}>
                    <span>{field.label}</span>
                    {field.type === "textarea" ? <textarea name={field.key} defaultValue={String(editing[field.key as keyof DemoProduct] ?? "")} rows={6} required={field.required} /> : field.type === "select" ? <select name={field.key} defaultValue={String(editing[field.key as keyof DemoProduct] ?? "")} required={field.required}>{field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select> : <input name={field.key} type={field.type} defaultValue={String(editing[field.key as keyof DemoProduct] ?? "")} required={field.required} />}
                  </label>
                ))}
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
