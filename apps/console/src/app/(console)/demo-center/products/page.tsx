import { DemoCenter } from "@/components/DemoCenter";
import { PageHeader } from "@/components/PageHeader";

export default function DemoProductsPage() {
  return (
    <main className="page">
      <PageHeader eyebrow="DEMO DATA" title="商品管理" description="维护 Agent 查询和办理业务时使用的演示商品数据。" />
      <DemoCenter view="products" />
    </main>
  );
}
