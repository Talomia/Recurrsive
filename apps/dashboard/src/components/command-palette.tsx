"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Brain,
  HeartPulse,
  Clock,
  GitCompare,
  FolderGit2,
  ShieldAlert,
  Lightbulb,
  Network,
  BarChart3,
  Layers,
  Calendar,
  FileText,
  Search,
  FlaskConical,
  Bot,
  Camera,
  Users,
  Shield,
  History,
  Settings,
  Key,
  Eye,
  Webhook,
  Bell,
  Zap,
  Package,
  KeyRound,
  Building2,
  Crown,
  Target,
  Sparkles,
  Play,
  Plus,
  UserPlus,
  Download,
  X,
  type LucideIcon,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────

interface PaletteItem {
  id: string;
  label: string;
  icon: LucideIcon;
  group: "Pages" | "Actions" | "Recent";
  /** For pages: the href to navigate to. For actions: a callback key. */
  href?: string;
  action?: () => void;
  keywords?: string[];
}

// ── Page list derived from sidebar nav ────────────────────

const PAGE_ITEMS: PaletteItem[] = [
  // Intelligence
  { id: "p-overview", label: "Overview", icon: LayoutDashboard, group: "Pages", href: "/", keywords: ["home", "dashboard"] },
  { id: "p-executive", label: "Executive", icon: Crown, group: "Pages", href: "/executive", keywords: ["exec", "summary"] },
  { id: "p-forecasting", label: "Forecasting", icon: Brain, group: "Pages", href: "/forecasting", keywords: ["predict", "ml"] },
  { id: "p-confidence", label: "Confidence", icon: Target, group: "Pages", href: "/confidence", keywords: ["score"] },
  // Analysis
  { id: "p-projects", label: "Projects", icon: FolderGit2, group: "Pages", href: "/projects", keywords: ["repos"] },
  { id: "p-findings", label: "Findings", icon: ShieldAlert, group: "Pages", href: "/findings", keywords: ["issues", "alerts"] },
  { id: "p-opportunities", label: "Opportunities", icon: Lightbulb, group: "Pages", href: "/opportunities", keywords: ["improve"] },
  { id: "p-insights", label: "Insights", icon: Sparkles, group: "Pages", href: "/insights", keywords: ["ai"] },
  { id: "p-system-map", label: "System Map", icon: Network, group: "Pages", href: "/system-map", keywords: ["architecture", "graph"] },
  { id: "p-health", label: "Health", icon: HeartPulse, group: "Pages", href: "/health", keywords: ["status"] },
  { id: "p-timeline", label: "Timeline", icon: Clock, group: "Pages", href: "/timeline", keywords: ["history", "events"] },
  // Operations
  { id: "p-batch", label: "Batch", icon: Layers, group: "Pages", href: "/batch", keywords: ["jobs"] },
  { id: "p-scheduling", label: "Scheduling", icon: Calendar, group: "Pages", href: "/scheduling", keywords: ["cron"] },
  { id: "p-reports", label: "Reports", icon: FileText, group: "Pages", href: "/reports", keywords: ["export"] },
  { id: "p-search", label: "Search", icon: Search, group: "Pages", href: "/search", keywords: ["find", "query"] },
  { id: "p-analytics", label: "Analytics", icon: BarChart3, group: "Pages", href: "/analytics", keywords: ["metrics", "charts"] },
  { id: "p-experiments", label: "Experiments", icon: FlaskConical, group: "Pages", href: "/experiments", keywords: ["ab-test"] },
  { id: "p-comparisons", label: "Comparisons", icon: GitCompare, group: "Pages", href: "/comparisons", keywords: ["diff"] },
  // Integrations
  { id: "p-simulation", label: "Simulation", icon: Bot, group: "Pages", href: "/simulation", keywords: ["simulate"] },
  { id: "p-snapshots", label: "Snapshots", icon: Camera, group: "Pages", href: "/snapshots", keywords: ["capture"] },
  { id: "p-webhooks", label: "Webhooks", icon: Webhook, group: "Pages", href: "/webhooks", keywords: ["hook"] },
  { id: "p-notifications", label: "Notifications", icon: Bell, group: "Pages", href: "/notifications", keywords: ["alerts"] },
  { id: "p-plugins", label: "Plugins", icon: Package, group: "Pages", href: "/plugins", keywords: ["extensions"] },
  { id: "p-marketplace", label: "Marketplace", icon: Zap, group: "Pages", href: "/marketplace", keywords: ["store"] },
  // Administration
  { id: "p-users", label: "Users", icon: Users, group: "Pages", href: "/users", keywords: ["members", "team"] },
  { id: "p-policies", label: "Policies", icon: Shield, group: "Pages", href: "/policies", keywords: ["rules", "permissions"] },
  { id: "p-audit", label: "Audit Trail", icon: History, group: "Pages", href: "/audit", keywords: ["log", "history"] },
  { id: "p-settings", label: "Settings", icon: Settings, group: "Pages", href: "/settings", keywords: ["config", "preferences"] },
  { id: "p-secrets", label: "Secrets", icon: Key, group: "Pages", href: "/secrets", keywords: ["tokens", "env"] },
  { id: "p-data-masking", label: "Data Masking", icon: Eye, group: "Pages", href: "/data-masking", keywords: ["privacy", "pii"] },
  // Enterprise
  { id: "p-sso", label: "SSO", icon: KeyRound, group: "Pages", href: "/sso", keywords: ["saml", "oidc"] },
  { id: "p-tenants", label: "Tenants", icon: Building2, group: "Pages", href: "/tenants", keywords: ["orgs", "multi-tenant"] },
];

// ── Fuzzy match helper ───────────────────────────────────

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function matchesItem(item: PaletteItem, query: string): boolean {
  if (fuzzyMatch(item.label, query)) return true;
  if (item.keywords?.some((kw) => fuzzyMatch(kw, query))) return true;
  if (item.href && fuzzyMatch(item.href, query)) return true;
  return false;
}

// ── Context ──────────────────────────────────────────────

const CommandPaletteCtx = createContext<{
  open: () => void;
  close: () => void;
  isOpen: boolean;
}>({ open: () => {}, close: () => {}, isOpen: false });

export const useCommandPalette = () => useContext(CommandPaletteCtx);

// ── Provider ─────────────────────────────────────────────

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <CommandPaletteCtx.Provider value={value}>
      {children}
      {isOpen && <CommandPaletteModal onClose={close} />}
    </CommandPaletteCtx.Provider>
  );
}

// ── Modal ────────────────────────────────────────────────

const RECENT_STORAGE_KEY = "recurrsive_cmd_recent";
const MAX_RECENT = 5;

function getRecentIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  const recent = getRecentIds().filter((r) => r !== id);
  recent.unshift(id);
  localStorage.setItem(
    RECENT_STORAGE_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT))
  );
}

function CommandPaletteModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Action items
  const actionItems: PaletteItem[] = useMemo(
    () => [
      { id: "a-run-analysis", label: "Run analysis", icon: Play, group: "Actions", keywords: ["analyze", "scan"] },
      { id: "a-create-project", label: "Create project", icon: Plus, group: "Actions", keywords: ["new", "add"] },
      { id: "a-invite-user", label: "Invite user", icon: UserPlus, group: "Actions", keywords: ["member", "team"] },
      { id: "a-export-report", label: "Export report", icon: Download, group: "Actions", keywords: ["download", "pdf"] },
    ],
    []
  );

  // Recent items
  const recentItems = useMemo(() => {
    const ids = getRecentIds();
    const allItems = [...PAGE_ITEMS, ...actionItems];
    return ids
      .map((id) => allItems.find((item) => item.id === id))
      .filter(Boolean)
      .map((item) => ({ ...item!, group: "Recent" as const }));
  }, [actionItems]);

  // Filtered + grouped results
  const results = useMemo(() => {
    const all = [...PAGE_ITEMS, ...actionItems];
    const filtered = query.trim()
      ? all.filter((item) => matchesItem(item, query.trim()))
      : all;

    // When no query, also prepend recent items
    const groups: { label: string; items: PaletteItem[] }[] = [];

    if (!query.trim() && recentItems.length > 0) {
      groups.push({ label: "Recent", items: recentItems });
    }

    const pages = filtered.filter((i) => i.group === "Pages");
    const actions = filtered.filter((i) => i.group === "Actions");

    if (pages.length > 0) groups.push({ label: "Pages", items: pages });
    if (actions.length > 0) groups.push({ label: "Actions", items: actions });

    return groups;
  }, [query, actionItems, recentItems]);

  const flatResults = useMemo(
    () => results.flatMap((g) => g.items),
    [results]
  );

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Auto-focus the input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-selected="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Execute an item
  const executeItem = useCallback(
    (item: PaletteItem) => {
      pushRecent(item.id);
      if (item.href) {
        router.push(item.href);
      } else if (item.action) {
        item.action();
      }
      onClose();
    },
    [router, onClose]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (flatResults[selectedIndex]) {
            executeItem(flatResults[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatResults, selectedIndex, executeItem, onClose]
  );

  // Focus trap: track first & last focusable
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    function trapFocus(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = modal!.querySelectorAll<HTMLElement>(
        'input, button, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", trapFocus);
    return () => document.removeEventListener("keydown", trapFocus);
  }, []);

  let itemCounter = 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-xl mx-4 overflow-hidden rounded-2xl"
        style={{
          background: "rgba(15, 15, 25, 0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow:
            "0 25px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.08)",
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search className="h-5 w-5 text-text-muted shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, actions…"
            aria-label="Search command palette"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          <button
            onClick={onClose}
            className="flex items-center justify-center h-6 w-6 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
            aria-label="Close command palette"
          >
            <X className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
          </button>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[360px] overflow-y-auto py-2"
          role="listbox"
          aria-label="Command palette results"
        >
          {flatResults.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-text-muted">No results found for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {results.map((group) => (
            <div key={group.label} role="group" aria-label={group.label}>
              <div className="px-4 pt-2 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                  {group.label}
                </span>
              </div>

              {group.items.map((item) => {
                const index = itemCounter++;
                const isSelected = index === selectedIndex;
                const Icon = item.icon;

                return (
                  <button
                    key={`${group.label}-${item.id}`}
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected}
                    onClick={() => executeItem(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      isSelected
                        ? "bg-white/8 text-text-primary"
                        : "text-text-secondary hover:bg-white/5"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isSelected ? "text-accent-blue" : "text-text-muted"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.href && (
                      <span className="text-[10px] text-text-tertiary font-mono">
                        {item.href}
                      </span>
                    )}
                    {isSelected && (
                      <kbd className="hidden sm:inline-flex items-center rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                        ↵
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5">
          <div className="flex items-center gap-3 text-[10px] text-text-muted">
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-white/5 px-1 py-0.5 font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-white/5 px-1 py-0.5 font-mono">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded bg-white/5 px-1 py-0.5 font-mono">esc</kbd>
              close
            </span>
          </div>
          <span className="text-[10px] text-text-tertiary">
            {flatResults.length} result{flatResults.length !== 1 && "s"}
          </span>
        </div>
      </div>
    </div>
  );
}
