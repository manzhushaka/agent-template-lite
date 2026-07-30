import { ApplicationLogViewer } from "@/components/ApplicationLogViewer";
import { PageHeader } from "@/components/PageHeader";

export default function LogsPage() {
  return <main className="page"><PageHeader eyebrow="RUNTIME OUTPUT" title="在线日志" description="实时查看 Chat、Console 和 AgentOS 的应用输出，按级别、运行时和关键字定位问题。" /><ApplicationLogViewer /></main>;
}
