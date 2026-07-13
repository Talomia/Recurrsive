"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveProject } from "./active-project-context";
import { useAuth, type Role } from "@/lib/auth-context";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Lightbulb,
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
  Layers,
  BarChart3,
  History,
  FlaskConical,
  ShieldAlert,
  FolderGit2,
  KeyRound,
  Calendar,
  Users,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

interface NavSection {
  key: string;
  label: string;
  items: ReadonlyArray<NavItem>;
  roles?: ReadonlyArray<Role>;
}

// ─── Section definitions ─────────────────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  {
    key: "intelligence",
    label: "Intelligence",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
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
      { href: "/experiments", label: "Experiments", icon: FlaskConical },
    ],
  },
  {
    key: "governance",
    label: "Governance",
    items: [
      { href: "/policies", label: "Policies", icon: Shield },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    roles: ["admin"],
    items: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/audit", label: "Audit Trail", icon: History },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/sso", label: "SSO", icon: KeyRound },
    ],
  },
];

// ─── localStorage helpers ────────────────────────────────────────────────────

const STORAGE_KEY = "recurrsive-sidebar-sections";

const DEFAULT_EXPANDED: Record<string, boolean> = {
  intelligence: true,
  analysis: true,
  operations: false,
  governance: false,
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
  const isPublicRoute = ["/login", "/setup", "/invite"].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [opportunityCount, setOpportunityCount] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(DEFAULT_EXPANDED);
  const { user } = useAuth();

  const { projects, activeProject, switchProject } = useActiveProject();
  const activeProjectId = activeProject?.id ?? null;
  const [showProjDropdown, setShowProjDropdown] = useState(false);
  const [projSearchQuery, setProjSearchQuery] = useState("");
  const projDropdownRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(
      mobileNavRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])') ?? [],
    ).filter((element) => element.tabIndex !== -1);
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [mobileOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showProjDropdown) return;
    function clickOutside(e: MouseEvent) {
      if (projDropdownRef.current && !projDropdownRef.current.contains(e.target as Node)) {
        setShowProjDropdown(false);
      }
    }
    document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, [showProjDropdown]);

  // Hydrate expansion state from localStorage
  useEffect(() => {
    setExpanded(loadExpanded());
  }, []);

  // Fetch opportunity count (skip on public pages to avoid 401 trigger redirect loops)
  useEffect(() => {
    const isPublic = ["/login", "/setup", "/invite"].some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (isPublic) return;
    if (!activeProjectId) {
      setOpportunityCount(0);
      return;
    }

    import("@/lib/api/client").then(({ apiFetch }) => {
      apiFetch<{ data: unknown[]; total: number }>(
        `/api/v1/opportunities?limit=1&projectId=${encodeURIComponent(activeProjectId)}`,
        { unwrap: false },
      )
        .then((res) => setOpportunityCount(res.total ?? 0))
        .catch((err) => {
          if (process.env.NODE_ENV === "development") {
            console.warn("[Sidebar] Failed to fetch opportunity count:", err);
          }
        });
    });
  }, [pathname, activeProjectId]);

  const toggleSection = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveExpanded(next);
      return next;
    });
  }, []);

  // Public authentication/setup flows use a distraction-free shell and must
  // never trigger authenticated project data requests.
  if (isPublicRoute) return null;

  return (
    <>
      {/* ── Mobile hamburger button ─────────────────────── */}
      <button
        className="fixed top-4 left-4 z-[60] flex items-center justify-center h-10 w-10 rounded-xl bg-surface border border-border lg:hidden"
        onClick={() => setMobileOpen((o) => !o)}
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileOpen}
        aria-controls="main-sidebar"
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
        id="main-sidebar"
        ref={mobileNavRef}
        className={clsx(
          "fixed left-0 top-0 z-50 flex h-full flex-col border-r border-border bg-surface transition-all duration-300",
          collapsed ? "lg:w-[68px]" : "lg:w-[260px]",
          mobileOpen ? "max-lg:translate-x-0 max-lg:w-[260px]" : "max-lg:-translate-x-full"
        )}
        aria-label="Main navigation"
      >
        {/* ── Logo ───────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-purple to-accent-pink shadow-[0_0_15px_rgba(192,132,252,0.4)] animate-pulse-dot">
            <Zap className="h-[18px] w-[18px] text-white" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden max-lg:block">
              <h2 className="text-base font-bold tracking-tight gradient-text leading-tight">
                Recurrsive
              </h2>
              <p className="text-[10px] text-text-secondary leading-tight">
                Engineering Intelligence
              </p>
            </div>
          )}
        </div>

        {/* ── Project Context Selector ───────────────────── */}
        {projects.length > 0 && (
          <div className="px-4 py-3 border-b border-border relative" ref={projDropdownRef}>
            {collapsed ? (
              <button
                onClick={() => setCollapsed(false)}
                className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-accent-purple"
                title={`Active: ${activeProject?.name ?? "None"}`}
              >
                <FolderGit2 className="h-4 w-4" />
              </button>
            ) : (
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted block mb-1 px-1">
                  Active Scope
                </span>
                <button
                  onClick={() => setShowProjDropdown(!showProjDropdown)}
                  className="w-full flex items-center justify-between rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 px-3 py-2 text-xs font-semibold text-text-primary transition-all group"
                  aria-expanded={showProjDropdown}
                  aria-haspopup="true"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderGit2 className="h-3.5 w-3.5 text-accent-purple shrink-0" />
                    <span className="truncate pr-1 leading-none">{activeProject?.name ?? "Select Project..."}</span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-text-secondary group-hover:text-text-primary transition-transform duration-200" />
                </button>
              </div>
            )}

            {/* Dropdown overlay */}
            {showProjDropdown && !collapsed && (
              <div
                className="absolute left-4 right-4 top-full mt-1.5 rounded-2xl z-50 overflow-hidden shadow-2xl transition-all animate-fade-in-up"
                style={{
                  background: "rgba(11, 10, 24, 0.95)",
                  backdropFilter: "blur(24px)",
                  border: "1px solid rgba(192, 132, 252, 0.15)",
                }}
              >
                {/* Search query input */}
                <div className="p-2 border-b border-white/10 flex items-center gap-2 bg-white/[0.02]">
                  <Search className="h-3.5 w-3.5 text-text-muted shrink-0" />
                  <input
                    type="text"
                    placeholder="Filter repositories..."
                    value={projSearchQuery}
                    onChange={(e) => setProjSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-none text-xs text-text-primary placeholder:text-text-muted outline-none"
                    aria-label="Filter repositories"
                  />
                </div>

                {/* Project list */}
                <div className="max-h-[220px] overflow-y-auto py-1">
                  {projects
                    .filter((p) => p.name.toLowerCase().includes(projSearchQuery.toLowerCase()))
                    .map((proj) => {
                      const isSelected = activeProject?.id === proj.id;
                      return (
                        <button
                          key={proj.id}
                          onClick={() => {
                            switchProject(proj.id);
                            setShowProjDropdown(false);
                            setProjSearchQuery("");
                          }}
                          className={clsx(
                            "w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-white/5",
                            isSelected ? "text-accent-purple font-bold bg-accent-purple/5" : "text-text-secondary"
                          )}
                        >
                          <span className="truncate pr-2">{proj.name}</span>
                          <span className="text-[10px] text-text-muted shrink-0 bg-white/5 px-1.5 py-0.5 rounded-md border border-white/5">
                            {proj.language}
                          </span>
                        </button>
                      );
                    })}
                  {projects.filter((p) => p.name.toLowerCase().includes(projSearchQuery.toLowerCase())).length === 0 && (
                    <div className="px-3 py-4 text-center text-xs text-text-muted">
                      No matching projects
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Nav links ──────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
          {NAV_SECTIONS.filter((section) => !section.roles || (user && section.roles.includes(user.role))).map((section) => {
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
                  {section.items.map(({ href, label, icon: Icon }) => {
                    const active =
                      href === "/" ? pathname === "/" : pathname.startsWith(href);
                    const activeProjectId = activeProject?.id;
                    const finalHref = activeProjectId && href !== "/projects"
                      ? `${href}?projectId=${encodeURIComponent(activeProjectId)}`
                      : href;
                    return (
                      <Link
                        key={href}
                        href={finalHref}
                        onClick={() => setMobileOpen(false)}
                        className={clsx(
                          "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
                          active
                            ? "bg-gradient-to-r from-accent-purple/10 to-accent-cyan/5 border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] text-text-primary"
                            : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        {active && <span className="nav-active-indicator" aria-hidden="true" />}
                        <Icon
                          className={clsx(
                            "h-[18px] w-[18px] shrink-0 transition-colors",
                            active
                              ? "text-accent-purple"
                              : "text-text-muted group-hover:text-text-secondary"
                          )}
                        />
                        {!collapsed && <span>{label}</span>}
                        
                        {/* Opportunity count badge */}
                        {!collapsed && href === "/opportunities" && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-purple/15 px-1.5 text-[10px] font-semibold text-purple-300">
                            {opportunityCount}
                          </span>
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
          {/* Evidence search status */}
          {!collapsed && (
            <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-accent-purple/10 to-accent-blue/10 border border-purple-500/15 px-3 py-2.5">
              <Bot className="h-[18px] w-[18px] text-purple-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-purple-300">
                  Analysis Search
                </p>
                <p className="text-[10px] text-text-muted truncate">
                  Uses recorded evidence
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
