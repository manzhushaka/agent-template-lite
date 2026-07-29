"use client";

import { Bot, Boxes, Database, Gauge, LogOut, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { publicPath } from "@/lib/public-path";

const nav = [
  { href: "/dashboard", label: "运行概览", icon: Gauge },
  { href: "/demo-center", label: "演示中心", icon: Boxes },
  { href: "/knowledge", label: "知识库", icon: Database },
  { href: "/agent", label: "智能体", icon: Bot },
];

export function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  async function logout() { await fetch(publicPath("/api/auth/logout"), { method: "POST" }); window.location.assign(publicPath("/login")); }
  return <div className="admin-layout"><aside className={open ? "open" : ""}><header className="console-brand"><span className="console-mark">M</span><div><strong>Agent Console</strong><small>CONTROL PLANE</small></div><button className="mobile-close" onClick={() => setOpen(false)} aria-label="关闭菜单"><X size={18} /></button></header><nav aria-label="控制台导航">{nav.map(({ href, label, icon: Icon }) => { const active = pathname.endsWith(href); return <a href={publicPath(href)} className={active ? "active" : ""} aria-current={active ? "page" : undefined} key={href}><Icon size={17} />{label}</a>; })}</nav><footer><div><span>{user.displayName}</span><small>{user.role}</small></div><button onClick={logout} title="退出登录" aria-label="退出登录"><LogOut size={17} /></button></footer></aside><div className="admin-main"><header className="mobile-header"><button onClick={() => setOpen(true)} aria-label="打开菜单"><Menu size={20} /></button><span className="console-mark">M</span><strong>Agent Console</strong></header>{children}</div>{open && <button className="nav-scrim" onClick={() => setOpen(false)} aria-label="关闭菜单" />}</div>;
}
