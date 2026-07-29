import { AdminShell } from "@/components/AdminShell";
import { requireSession } from "@/lib/auth";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSession();
  return <AdminShell user={user}>{children}</AdminShell>;
}
