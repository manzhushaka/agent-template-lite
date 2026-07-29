import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "智能业务助手控制台", description: "Agent Demo Console" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
