import { AuditLog } from "@/components/AuditLog";
import { PageHeader } from "@/components/PageHeader";

export default function AuditPage() {
  return <main className="page"><PageHeader eyebrow="GOVERNANCE" title="审计日志" description="查询 Console 与 Agent 内部写操作，定位索引、确认和业务动作结果。" /><AuditLog /></main>;
}
