"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginationMeta } from "@/lib/pagination";

interface TablePaginationProps {
  pagination: PaginationMeta;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function initialPagination(pageSize = 10): PaginationMeta {
  return { page: 1, pageSize, total: 0, totalPages: 1 };
}

export function TablePagination({
  pagination,
  loading = false,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <footer className="table-pagination" aria-label="表格分页">
      <span className="pagination-summary">
        共 <strong>{pagination.total}</strong> 条，当前 {start}-{end} 条
      </span>
      <div className="pagination-controls">
        <label>
          <span>每页</span>
          <select
            aria-label="每页条数"
            value={pagination.pageSize}
            disabled={loading}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            <option value={10}>10 条</option>
            <option value={20}>20 条</option>
            <option value={50}>50 条</option>
          </select>
        </label>
        <button
          type="button"
          className="pagination-button"
          aria-label="上一页"
          title="上一页"
          disabled={loading || pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <span className="pagination-page">
          {pagination.page} / {pagination.totalPages}
        </span>
        <button
          type="button"
          className="pagination-button"
          aria-label="下一页"
          title="下一页"
          disabled={loading || pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </footer>
  );
}
