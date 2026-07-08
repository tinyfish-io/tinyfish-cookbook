"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Compass, FileText, Building2, ChevronsLeft, ChevronsRight } from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/applications", label: "Applications", icon: FileText },
  { href: "/company-profile", label: "Company profile", icon: Building2 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("founder-mode-sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
    setMounted(true);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("founder-mode-sidebar-collapsed", String(next));
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ type: "spring", stiffness: 340, damping: 32 }}
      className="hidden md:flex md:flex-col md:shrink-0 border-r border-border bg-surface relative overflow-hidden"
      style={{ width: collapsed ? 72 : 240 }}
    >
      <div className={`pt-6 pb-5 border-b border-border ${collapsed ? "px-3" : "px-5"}`}>
        <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white shrink-0">
            <Logo size={17} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-medium text-[15px] leading-none tracking-tight whitespace-nowrap">
                Founder <span className="text-accent">Mode</span>
              </p>
              <p className="text-[11px] text-text-muted mt-1 whitespace-nowrap">Kaira Labs · Workspace</p>
            </div>
          )}
        </div>
      </div>

      <nav className={`flex-1 py-4 space-y-1 ${collapsed ? "px-2" : "px-3"}`}>
        {!collapsed && <p className="px-3 text-[10px] tracking-wider text-text-muted font-medium mb-1">WORKSPACE</p>}
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`relative flex items-center gap-2.5 py-2 rounded-md text-sm transition-colors group ${
                collapsed ? "justify-center px-0" : "px-3"
              } ${active ? "text-text-primary font-medium bg-surface-alt" : "text-text-secondary hover:text-text-primary hover:bg-surface-alt"}`}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active-bar"
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon size={16} strokeWidth={1.75} className={active ? "text-accent" : ""} />
              {!collapsed && item.label}
              {collapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-surface border border-border text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={`py-4 border-t border-border flex items-center ${collapsed ? "flex-col gap-3 px-2" : "justify-between px-5"}`}>
        {!collapsed && <p className="text-[11px] text-text-muted">Vietnam startup ecosystem</p>}
        <ThemeToggle />
      </div>

      <button
        onClick={toggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center text-text-muted hover:text-accent hover:border-accent/40 transition-colors shadow-sm z-10"
      >
        {collapsed ? <ChevronsRight size={12} /> : <ChevronsLeft size={12} />}
      </button>
    </motion.aside>
  );
}
