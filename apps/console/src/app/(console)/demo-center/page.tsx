import { DemoCenter } from "@/components/DemoCenter";
import { PageHeader } from "@/components/PageHeader";
export default function DemoCenterPage() { return <main className="page"><PageHeader eyebrow="DEMO DATA" title="演示中心" description="用 CRUD 维护 Agent 查询和办理业务时使用的演示数据。" /><DemoCenter /></main>; }
