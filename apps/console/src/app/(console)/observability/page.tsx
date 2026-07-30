import { ObservabilityDashboard } from "@/components/ObservabilityDashboard";
import { PageHeader } from "@/components/PageHeader";

export default function ObservabilityPage() {
  return <main className="page"><PageHeader eyebrow="AGENT OPERATIONS" title="运行监控" description="查看 Session、Run、Trace、Token、耗时、异常和人工确认状态。" /><ObservabilityDashboard /></main>;
}
