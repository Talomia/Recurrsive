"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Lightbulb,
  Sparkles,
  Network,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bot,
  Zap,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Evolution Overview", icon: LayoutDashboard },
  { href: "/opportunities", label: "Opportunities", icon: Lightbulb },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/system-map", label: "System Map", icon: Network },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile overlay — shown only on small screens when expanded */}
      <div
        className={clsx(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity",
          collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        onClick={() => setCollapsed(true)}
      />

      <aside
        className={clsx(
          "fixed left-0 top-0 z-50 flex h-full flex-col border-r border-border bg-surface transition-all duration-300",
          collapsed ? "w-[68px]" : "w-[260px]",
          // On mobile, show/hide
          "max-lg:translate-x-0",
        )}
      >
        {/* ── Logo ───────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple shadow-lg">
            <Zap className="h-4.5 w-4.5 text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h2 className="text-base font-bold tracking-tight gradient-text leading-tight">
                Recurrsive
              </h2>
              <p className="text-[10px] text-text-muted leading-tight">
                Software Evolution Platform
              </p>
            </div>
          )}
        </div>

        {/* ── Nav links ──────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
                  active
                    ? "bg-white/8 text-text-primary"
                    : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                )}
              >
                {active && <span className="nav-active-indicator" />}
                <Icon
                  className={clsx(
                    "h-[18px] w-[18px] shrink-0 transition-colors",
                    active ? "text-accent-blue" : "text-text-muted group-hover:text-text-secondary"
                  )}
                />
                {!collapsed && <span>{label}</span>}
                {!collapsed && href === "/opportunities" && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-blue/15 px-1.5 text-[10px] font-semibold text-blue-400">
                    23
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Bottom ─────────────────────────────────────── */}
        <div className="px-3 pb-4 space-y-2">
          {/* AI Assistant badge */}
          {!collapsed && (
            <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-accent-purple/10 to-accent-blue/10 border border-purple-500/15 px-3 py-2.5">
              <Bot className="h-4.5 w-4.5 text-purple-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-purple-300">
                  Recurrsive AI
                </p>
                <p className="text-[10px] text-text-muted truncate">
                  Analyzing your codebase…
                </p>
              </div>
              <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse-dot shrink-0" />
            </div>
          )}
          {collapsed && (
            <div className="flex justify-center">
              <Bot className="h-5 w-5 text-purple-400" />
            </div>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-2 text-xs text-text-muted hover:bg-white/8 hover:text-text-secondary transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Spacer so content doesn't go under the sidebar */}
      <div
        className={clsx(
          "hidden lg:block shrink-0 transition-all duration-300",
          collapsed ? "w-[68px]" : "w-[260px]"
        )}
      />
    </>
  );
}
