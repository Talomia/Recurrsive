"use client";

import { useState, useEffect } from "react";
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
  Menu,
  X,
  Search,
  Shield,
  Clock,
  Webhook,
  Bell,
  Layers,
  BarChart3,
  History,
  FlaskConical,
  GitCompare,
  ShieldAlert,
  HeartPulse,
  Camera,
  Crown,
  Brain,
  FolderGit2,
  Package,
  Key,
  KeyRound,
  Building2,
  Calendar,
  Target,
  Cloud,
  Eye,
  Boxes,
} from "lucide-react";

interface NavSection {
  label: string;
  tier?: 'enterprise' | 'ecosystem';
  items: ReadonlyArray<{ readonly href: string; readonly label: string; readonly icon: any }>;
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Intelligence',
    items: [
      { href: '/', label: 'Overview', icon: LayoutDashboard },
      { href: '/executive', label: 'Executive', icon: Crown },
      { href: '/forecasting', label: 'Forecasting', icon: Brain },
      { href: '/confidence', label: 'Confidence', icon: Target },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { href: '/projects', label: 'Projects', icon: FolderGit2 },
      { href: '/opportunities', label: 'Opportunities', icon: Lightbulb },
      { href: '/findings', label: 'Findings', icon: ShieldAlert },
      { href: '/insights', label: 'Insights', icon: Sparkles },
      { href: '/system-map', label: 'System Map', icon: Network },
      { href: '/health', label: 'Health', icon: HeartPulse },
      { href: '/timeline', label: 'Timeline', icon: Clock },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/batch', label: 'Batch', icon: Layers },
      { href: '/scheduling', label: 'Scheduling', icon: Calendar },
      { href: '/reports', label: 'Reports', icon: FileText },
      { href: '/search', label: 'Search', icon: Search },
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/experiments', label: 'Experiments', icon: FlaskConical },
      { href: '/comparisons', label: 'Comparisons', icon: GitCompare },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { href: '/webhooks', label: 'Webhooks', icon: Webhook },
      { href: '/notifications', label: 'Notifications', icon: Bell },
      { href: '/snapshots', label: 'Snapshots', icon: Camera },
      { href: '/simulation', label: 'Simulation', icon: Bot },
      { href: '/plugins', label: 'Plugins', icon: Package },
      { href: '/intelligence-packs', label: 'Intelligence Packs', icon: Boxes },
      { href: '/marketplace', label: 'Marketplace', icon: Zap },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/policies', label: 'Policies', icon: Shield },
      { href: '/audit', label: 'Audit Trail', icon: History },
      { href: '/secrets', label: 'Secrets', icon: Key },
      { href: '/data-masking', label: 'Data Masking', icon: Eye },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    label: 'Enterprise',
    tier: 'enterprise',
    items: [
      { href: '/sso', label: 'SSO', icon: KeyRound },
      { href: '/tenants', label: 'Tenants', icon: Building2 },
    ],
  },
  {
    label: 'Cloud',
    tier: 'ecosystem',
    items: [
      { href: '/cloud', label: 'Cloud Dashboard', icon: Cloud },
      { href: '/partners', label: 'Partners', icon: Building2 },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  // Mobile sidebar is closed by default
  const [mobileOpen, setMobileOpen] = useState(false);
  const [opportunityCount, setOpportunityCount] = useState(23);

  useEffect(() => {
    fetch('/api/v1/opportunities')
      .then((r) => r.json())
      .then((data) => setOpportunityCount(data.data?.length ?? 23))
      .catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Sidebar] Failed to fetch opportunity count:', err);
        }
      });
  }, []);

  // Hide sidebar on the login page
  if (pathname === '/login') return null;

  return (
    <>
      {/* ── Mobile hamburger button ─────────────────────── */}
      <button
        className="fixed top-4 left-4 z-[60] flex items-center justify-center h-10 w-10 rounded-xl bg-surface border border-border lg:hidden"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
      >
        {mobileOpen ? (
          <X className="h-5 w-5 text-text-secondary" />
        ) : (
          <Menu className="h-5 w-5 text-text-secondary" />
        )}
      </button>

      {/* Mobile overlay — shown only on small screens when open */}
      <div
        className={clsx(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={clsx(
          "fixed left-0 top-0 z-50 flex h-full flex-col border-r border-border bg-surface transition-all duration-300",
          // Desktop: collapsed/expanded
          collapsed ? "lg:w-[68px]" : "lg:w-[260px]",
          // Mobile: slide in/out
          mobileOpen ? "max-lg:translate-x-0 max-lg:w-[260px]" : "max-lg:-translate-x-full",
        )}
        aria-label="Main navigation"
      >
        {/* ── Logo ───────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple shadow-lg">
            <Zap className="h-[18px] w-[18px] text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden max-lg:block">
              <h2 className="text-base font-bold tracking-tight gradient-text leading-tight">
                Recurrsive
              </h2>
              <p className="text-[10px] text-text-muted leading-tight">
                Engineering Intelligence
              </p>
            </div>
          )}
        </div>

        {/* ── Nav links ──────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-1">
              {/* Section header — only shown when sidebar is expanded */}
              {!collapsed && (
                <div className="flex items-center gap-1.5 px-3 pt-3 pb-1.5">
                  <span className="text-text-tertiary text-[10px] font-semibold uppercase tracking-widest">
                    {section.label}
                  </span>
                  {section.tier === 'enterprise' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" title="Enterprise tier" />
                  )}
                  {section.tier === 'ecosystem' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" title="Ecosystem tier" />
                  )}
                </div>
              )}

              {/* Section items */}
              {section.items.map(({ href, label, icon: Icon }) => {
                const active =
                  href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={clsx(
                      "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
                      active
                        ? "bg-white/8 text-text-primary"
                        : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {active && <span className="nav-active-indicator" aria-hidden="true" />}
                    <Icon
                      className={clsx(
                        "h-[18px] w-[18px] shrink-0 transition-colors",
                        active ? "text-accent-blue" : "text-text-muted group-hover:text-text-secondary"
                      )}
                    />
                    {!collapsed && <span>{label}</span>}
                    {!collapsed && href === "/opportunities" && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-blue/15 px-1.5 text-[10px] font-semibold text-blue-400">
                        {opportunityCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── Bottom ─────────────────────────────────────── */}
        <div className="px-3 pb-4 space-y-2">
          {/* AI Assistant badge */}
          {!collapsed && (
            <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-accent-purple/10 to-accent-blue/10 border border-purple-500/15 px-3 py-2.5">
              <Bot className="h-[18px] w-[18px] text-purple-400 shrink-0" />
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

          {/* Collapse toggle — desktop only */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-2 text-xs text-text-muted hover:bg-white/8 hover:text-text-secondary transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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

      {/* Spacer so content doesn't go under the sidebar on desktop */}
      <div
        className={clsx(
          "hidden lg:block shrink-0 transition-all duration-300",
          collapsed ? "w-[68px]" : "w-[260px]"
        )}
      />
    </>
  );
}
