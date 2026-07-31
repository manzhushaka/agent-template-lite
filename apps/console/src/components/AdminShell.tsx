"use client";

import { Activity, Bot, Boxes, ChevronDown, ChevronRight, ClipboardList, Database, Gauge, Logs, LogOut, Menu, ScrollText, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { publicPath } from "@/lib/public-path";

const navigation = [
  { id: "workspace", label: "工作台", icon: Gauge, items: [{ href: "/dashboard", label: "运行概览", icon: Gauge }] },
  { id: "demo-center", label: "演示中心", icon: Boxes, items: [{ href: "/demo-center/products", label: "商品管理", icon: Boxes }, { href: "/demo-center/orders", label: "订单记录", icon: ClipboardList }] },
  { id: "agent", label: "智能体运营", icon: Activity, items: [{ href: "/observability", label: "运行监控", icon: Activity }, { href: "/logs", label: "在线日志", icon: Logs }, { href: "/agent", label: "智能体配置", icon: Bot }] },
  { id: "governance", label: "治理中心", icon: ShieldCheck, items: [{ href: "/knowledge", label: "知识库", icon: Database }, { href: "/audit", label: "审计日志", icon: ScrollText }] },
];

export function AdminShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const activeGroup = navigation.find((group) => group.items.some((item) => pathname.endsWith(item.href)));
  const activeItem = activeGroup?.items.find((item) => pathname.endsWith(item.href));
  const ActiveIcon = activeItem?.icon ?? Gauge;
  const avatarText = user.displayName.trim().charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase();
  async function logout() { await fetch(publicPath("/api/auth/logout"), { method: "POST" }); window.location.assign(publicPath("/login")); }
  return <div className="admin-layout"><aside className={open ? "open" : ""}><header className="console-brand"><span className="console-mark">M</span><div><strong>Agent Console</strong><small>CONTROL PLANE</small></div><button className="mobile-close" onClick={() => setOpen(false)} aria-label="关闭菜单"><X size={18} /></button></header><nav aria-label="控制台导航">{navigation.map((group) => {
    const groupActive = group.items.some((item) => pathname.endsWith(item.href));
    const expanded = !collapsed[group.id] || groupActive;
    const GroupIcon = group.icon;
    return <section className="nav-group" key={group.id}><button type="button" className={groupActive ? "nav-group-trigger active" : "nav-group-trigger"} aria-expanded={expanded} onClick={() => setCollapsed((current) => ({ ...current, [group.id]: expanded }))}><GroupIcon size={15} /><span>{group.label}</span><ChevronDown className={expanded ? "expanded" : ""} size={14} /></button>{expanded && <div className="nav-group-items">{group.items.map(({ href, label, icon: Icon }) => { const active = pathname.endsWith(href); return <Link href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined} key={href} onClick={() => setOpen(false)}><Icon size={16} />{label}</Link>; })}</div>}</section>;
  })}</nav><footer><div><span>{user.displayName}</span><small>{user.role}</small></div><button onClick={logout} title="退出登录" aria-label="退出登录"><LogOut size={17} /></button></footer></aside><div className="admin-main"><header className="console-header"><nav className="console-breadcrumb" aria-label="当前位置"><span>{activeGroup?.label ?? "控制台"}</span><ChevronRight size={14} aria-hidden="true" /><strong><ActiveIcon size={16} aria-hidden="true" />{activeItem?.label ?? "概览"}</strong></nav><div className="console-header-user" aria-label={`当前用户：${user.displayName}`}><span className="console-avatar" aria-hidden="true">{avatarText}</span><div><strong>{user.displayName}</strong><small>{user.role}</small></div></div></header><header className="mobile-header"><button onClick={() => setOpen(true)} aria-label="打开菜单"><Menu size={20} /></button><span className="console-mark">M</span><div className="mobile-context"><small>{activeGroup?.label ?? "Agent Console"}</small><strong>{activeItem?.label ?? "控制台"}</strong></div></header>{children}</div>{open && <button className="nav-scrim" onClick={() => setOpen(false)} aria-label="关闭菜单" />}</div>;
}
