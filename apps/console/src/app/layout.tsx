import type { Metadata } from "next";
import { PROJECT_CONFIG } from "@template/shared";
import "./globals.css";

export const metadata: Metadata = { title: `${PROJECT_CONFIG.name}控制台`, description: "Agent Demo Console" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
