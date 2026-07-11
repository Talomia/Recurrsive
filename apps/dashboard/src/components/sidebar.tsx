"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  ChevronDown,
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
  Brain,
  FolderGit2,
  Package,
  Key,
  KeyRound,
  Building2,
  Calendar,
  Eye,
  Users,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: any;
  /** Show a small purple enterprise badge next to this item */
  readonly enterprise?: boolean;
}

interface NavSection {
  key: string;
  label: string;
  items: ReadonlyArray<NavItem>;
}

// ─── Section definitions ─────────────────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  {
    key: "intelligence",
    label: "Intelligence",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/forecasting", label: "Forecasting", icon: Brain },
      { href: "/health", label: "Health", icon: HeartPulse },
      { href: "/timeline", label: "Timeline", icon: Clock },
      { href: "/comparisons", label: "Comparisons", icon: GitCompare },
    ],
  },
  {
    key: "analysis",
    label: "Analysis",
    items: [
      { href: "/projects", label: "Projects", icon: FolderGit2 },
      { href: "/findings", label: "Findings", icon: ShieldAlert },
      { href: "/opportunities", label: "Opportunities", icon: Lightbulb },
      { href: "/system-map", label: "System Map", icon: Network },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    items: [
      { href: "/batch", label: "Batch", icon: Layers },
      { href: "/scheduling", label: "Scheduling", icon: Calendar },
      { href: "/reports", label: "Reports", icon: FileText },
      { href: "/search", label: "Search", icon: Search },
      { href: "/experiments", label: "Experiments", icon: FlaskConical },
      { href: "/simulation", label: "Simulation", icon: Bot },
      { href: "/snapshots", label: "Snapshots", icon: Camera },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    items: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/policies", label: "Policies", icon: Shield },
      { href: "/audit", label: "Audit Trail", icon: History },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/secrets", label: "Secrets", icon: Key },
      { href: "/data-masking", label: "Data Masking", icon: Eye },
      { href: "/webhooks", label: "Webhooks", icon: Webhook },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/marketplace", label: "Marketplace", icon: Sparkles },
      { href: "/plugins", label: "Plugins", icon: Package },
      { href: "/sso", label: "SSO", icon: KeyRound, enterprise: true },
      { href: "/tenants", label: "Tenants", icon: Building2, enterprise: true },
    ],
  },
];

// ─── localStorage helpers ────────────────────────────────────────────────────

const STORAGE_KEY = "recurrsive-sidebar-sections";

const DEFAULT_EXPANDED: Record<string, boolean> = {
  intelligence: true,
  analysis: true,
  operations: false,
  administration: false,
};

function loadExpanded(): Record<string, boolean> {
  if (typeof window === "undefined") return DEFAULT_EXPANDED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_EXPANDED, ...JSON.parse(raw) };
  } catch {
    // ignore corrupt data
  }
  return DEFAULT_EXPANDED;
}

function saveExpanded(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [opportunityCount, setOpportunityCount] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(DEFAULT_EXPANDED);

  // Hydrate expansion state from localStorage
  useEffect(() => {
    setExpanded(loadExpanded());
  }, []);

  // Fetch opportunity count
  useEffect(() => {
    import("@/lib/api/client").then(({ apiFetch }) => {
      apiFetch<{ data: unknown[]; total: number }>("/api/v1/opportunities?limit=1")
        .then((res) => setOpportunityCount(res.total ?? 0))
        .catch((err) => {
          if (process.env.NODE_ENV === "development") {
            console.warn("[Sidebar] Failed to fetch opportunity count:", err);
          }
        });
    });
  }, []);

  const toggleSection = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveExpanded(next);
      return next;
    });
  }, []);

  // Hide sidebar on the login page
  if (pathname === "/login") return null;

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
          collapsed ? "lg:w-[68px]" : "lg:w-[260px]",
          mobileOpen ? "max-lg:translate-x-0 max-lg:w-[260px]" : "max-lg:-translate-x-full"
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
          {NAV_SECTIONS.map((section) => {
            const isExpanded = expanded[section.key] ?? true;
            const hasActiveItem = section.items.some(({ href }) =>
              href === "/" ? pathname === "/" : pathname.startsWith(href)
            );

            return (
              <div key={section.key} className="mb-1">
                {/* Section header — clickable to toggle, hidden when sidebar collapsed */}
                {!collapsed ? (
                  <button
                    onClick={() => toggleSection(section.key)}
                    className={clsx(
                      "flex w-full items-center gap-1.5 px-3 pt-3 pb-1.5 group cursor-pointer",
                      "hover:bg-white/3 rounded-lg transition-colors"
                    )}
                    aria-expanded={isExpanded}
                    aria-controls={`nav-section-${section.key}`}
                  >
                    <ChevronDown
                      className={clsx(
                        "h-3 w-3 text-text-tertiary transition-transform duration-200",
                        !isExpanded && "-rotate-90"
                      )}
                    />
                    <span className="text-text-tertiary text-[10px] font-semibold uppercase tracking-widest select-none">
                      {section.label}
                    </span>
                    {/* Dot indicating active child when section is collapsed */}
                    {!isExpanded && hasActiveItem && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-blue shrink-0" />
                    )}
                  </button>
                ) : (
                  /* In collapsed sidebar: show a thin divider between sections */
                  <div className="mx-2 my-2 border-t border-border/50" />
                )}

                {/* Section items with animated expand/collapse */}
                <CollapsibleSection
                  id={`nav-section-${section.key}`}
                  isOpen={collapsed || isExpanded}
                >
                  {section.items.map(({ href, label, icon: Icon, enterprise }) => {
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
                            active
                              ? "text-accent-blue"
                              : "text-text-muted group-hover:text-text-secondary"
                          )}
                        />
                        {!collapsed && <span>{label}</span>}

                        {/* Opportunity count badge */}
                        {!collapsed && href === "/opportunities" && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-blue/15 px-1.5 text-[10px] font-semibold text-blue-400">
                            {opportunityCount}
                          </span>
                        )}

                        {/* Enterprise badge (purple dot) */}
                        {!collapsed && enterprise && (
                          <span
                            className="ml-auto h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0"
                            title="Enterprise"
                          />
                        )}
                      </Link>
                    );
                  })}
                </CollapsibleSection>
              </div>
            );
          })}
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
                  Ready for analysis
                </p>
              </div>
              <span className="h-2 w-2 rounded-full bg-purple-400 shrink-0" />
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

// ─── Collapsible section wrapper ─────────────────────────────────────────────

function CollapsibleSection({
  id,
  isOpen,
  children,
}: {
  id: string;
  isOpen: boolean;
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<string>(isOpen ? "none" : "0px");

  useEffect(() => {
    if (isOpen) {
      // Measure real height, set it, then switch to "none" after transition
      const el = contentRef.current;
      if (el) {
        setMaxHeight(`${el.scrollHeight}px`);
        const timer = setTimeout(() => setMaxHeight("none"), 250);
        return () => clearTimeout(timer);
      }
    } else {
      // Collapse: first set explicit height, then on next frame set 0
      const el = contentRef.current;
      if (el) {
        setMaxHeight(`${el.scrollHeight}px`);
        // Force reflow so the browser registers the explicit height
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.offsetHeight;
        requestAnimationFrame(() => setMaxHeight("0px"));
      }
    }
  }, [isOpen]);

  return (
    <div
      id={id}
      ref={contentRef}
      className="overflow-hidden transition-[max-height] duration-200 ease-in-out"
      style={{ maxHeight }}
      aria-hidden={!isOpen}
    >
      {children}
    </div>
  );
}
