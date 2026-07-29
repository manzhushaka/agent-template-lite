import { AgentOverview } from "@/components/AgentOverview";
import { PageHeader } from "@/components/PageHeader";
export default function AgentPage() { return <main className="page"><PageHeader eyebrow="AGENTOS" title="智能体" description="查看真实模型、Tools、知识索引和人工确认能力是否正确装配。" /><AgentOverview /></main>; }
