import { KnowledgeManager } from "@/components/KnowledgeManager";
import { PageHeader } from "@/components/PageHeader";
export default function KnowledgePage() { return <main className="page"><PageHeader eyebrow="KNOWLEDGE" title="知识库" description="MySQL 管理文档生命周期，LanceDB 保存可重建的向量索引。" /><KnowledgeManager /></main>; }
