import { DemoCenter } from "@/components/DemoCenter";
import { PageHeader } from "@/components/PageHeader";

export default function DemoOrdersPage() {
  return (
    <main className="page">
      <PageHeader eyebrow="DEMO DATA" title="订单记录" description="查看 Agent 办理业务后生成的演示订单记录。" />
      <DemoCenter view="orders" />
    </main>
  );
}
