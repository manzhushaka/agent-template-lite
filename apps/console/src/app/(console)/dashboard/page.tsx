import { Dashboard } from "@/components/Dashboard";
import { PageHeader } from "@/components/PageHeader";
export default function DashboardPage() { return <main className="page"><PageHeader eyebrow="CONTROL OVERVIEW" title="运行概览" description="检查演示数据、知识索引和智能体调用是否处在可演示状态。" /><Dashboard /></main>; }
