"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Bell, Sparkles, LogOut, User, Settings, ChevronRight, type LucideIcon } from "lucide-react";
import { useWebSocket } from "../hooks/useWebSocket";
import { LiveIndicator } from "./LiveIndicator";
import { useAuth } from "@/lib/auth-context";
import { useActiveProject } from "./active-project-context";
import NotificationsPanel from "./notifications-panel";
import AiChatPanel from "./ai-chat-panel";

/** A single breadcrumb segment rendered above the page title. */
export interface HeaderBreadcrumb {
  label: string;
  /** When present, the crumb is a link (e.g. back to the list page). */
  href?: string;
}

/**
 * The page's primary action, rendered as a prominent button on the right of
 * the header. Provide `href` (navigation) OR `onClick` (in-page action).
 * Note: `onClick` and `icon` are only usable from client components — server
 * pages should pass an href-only action.
 */
export interface HeaderPrimaryAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  /** Disable the action (e.g. while an analysis is already running). */
  disabled?: boolean;
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Optional ancestry trail (detail pages: e.g. Findings › #F-123). */
  breadcrumbs?: HeaderBreadcrumb[];
  /** Optional prominent action button (list pages: e.g. New Analysis). */
  primaryAction?: HeaderPrimaryAction;
}

/** Map role to display color. */
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: 'rgba(139, 92, 246, 0.15)', text: '#a78bfa' },
  analyst: { bg: 'rgba(59, 130, 246, 0.15)', text: '#93bbfd' },
  viewer: { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af' },
};

export default function Header({ title, subtitle, breadcrumbs, primaryAction }: HeaderProps) {
  const router = useRouter();
  const { activeProject } = useActiveProject();
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showUserMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (showUserMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Escape to close any open panel
      if (e.key === 'Escape') {
        if (showUserMenu) {
          setShowUserMenu(false);
          menuButtonRef.current?.focus();
        }
        if (showAiChat) setShowAiChat(false);
        if (showCommandPalette) setShowCommandPalette(false);
      }
      // ⌘K / Ctrl+K to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showUserMenu, showAiChat, showCommandPalette]);

  const { status, clientCount } = useWebSocket({ autoConnect: true });
  const { user, logout } = useAuth();

  const activeProjectId = activeProject?.id;

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      // Preserve the active project scope across navigation.
      const scope = activeProjectId ? `&projectId=${encodeURIComponent(activeProjectId)}` : "";
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}${scope}`);
    }
  };

  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
    router.push('/login');
  };

  // Handle keyboard navigation in user dropdown menu
  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowUserMenu(false);
      menuButtonRef.current?.focus();
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
      if (!items?.length) return;
      const current = document.activeElement;
      const idx = Array.from(items).indexOf(current as HTMLElement);
      const next = e.key === 'ArrowDown'
        ? items[(idx + 1) % items.length]
        : items[(idx - 1 + items.length) % items.length];
      next?.focus();
    }
  }, []);

  const initials = user
    ? user.username.slice(0, 2).toUpperCase()
    : 'RC';

  const roleStyle = user
    ? ROLE_COLORS[user.role] ?? ROLE_COLORS.viewer
    : ROLE_COLORS.viewer;

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-6 py-4" aria-label="Page header">
        {/* Left: breadcrumbs + title */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 mb-1 text-xs">
                {breadcrumbs.map((crumb, i) => (
                  <span key={`${crumb.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
                    {i > 0 && (
                      <ChevronRight className="h-3 w-3 shrink-0 text-text-muted" aria-hidden="true" />
                    )}
                    {crumb.href ? (
                      <Link
                        href={crumb.href}
                        className="text-text-muted hover:text-text-primary transition-colors truncate max-w-[240px]"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-text-secondary truncate max-w-[280px]" aria-current="page">
                        {crumb.label}
                      </span>
                    )}
                  </span>
                ))}
              </nav>
            )}
            <h1 className="text-xl font-bold text-text-primary truncate">{title}</h1>
            {subtitle && (
              <p className="mt-0.5 text-sm text-text-muted truncate">{subtitle}</p>
            )}
          </div>
          {activeProject && (
            <div className="hidden md:flex items-center gap-2 rounded-xl bg-accent-purple/10 px-3 py-1.5 border border-accent-purple/20 shadow-[0_0_10px_rgba(192,132,252,0.15)] animate-fade-in animate-pulse-slow">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-purple" />
              <span className="text-[11px] font-semibold text-purple-300">
                Project: {activeProject.name}
              </span>
            </div>
          )}
        </div>

        {/* Right: primary action + search + actions */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Primary page action */}
          {primaryAction && <PrimaryActionButton action={primaryAction} />}

          {/* Search */}
          <div className="hidden md:flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/5 focus-within:border-accent-blue/40 transition-colors">
            <Search className="h-4 w-4 text-text-muted" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search everything…"
              aria-label="Search dashboard"
              className="bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none w-48"
            />
            <button
              onClick={() => setShowCommandPalette(true)}
              className="hidden lg:inline-flex items-center gap-0.5 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-text-muted hover:bg-white/10 transition-colors"
              aria-label="Open command palette"
            >
              ⌘K
            </button>
          </div>

          {/* Live status */}
          <LiveIndicator status={status} clientCount={clientCount} showClientCount size="sm" />

          {/* AI chip */}
          <button
            onClick={() => setShowAiChat(true)}
            className="hidden sm:flex items-center gap-1.5 rounded-xl bg-accent-purple/10 px-3 py-2 text-xs font-medium text-purple-400 border border-purple-500/20 hover:bg-accent-purple/20 transition-colors"
            aria-label="Open AI assistant"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            AI Assist
          </button>

          {/* Notifications Panel */}
          <NotificationsPanel />

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              ref={menuButtonRef}
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/5 transition-colors"
              aria-label="User menu"
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple text-xs font-bold text-white"
                role="img"
                aria-label={`User avatar: ${user?.username ?? 'Guest'}`}
              >
                {initials}
              </div>
              {user && (
                <div className="hidden lg:flex flex-col items-start">
                  <span className="text-xs font-medium text-text-primary">{user.username}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: roleStyle.bg, color: roleStyle.text }}>
                    {user.role}
                  </span>
                </div>
              )}
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <div
                className="absolute right-0 top-full mt-1 w-48 rounded-xl overflow-hidden z-50 glass-card"
                role="menu"
                aria-label="User actions"
                onKeyDown={handleMenuKeyDown}
              >
                {user && (
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="text-sm font-medium text-text-primary">{user.username}</p>
                    <p className="text-xs text-text-secondary">{user.role} · {user.userId.slice(0, 8)}</p>
                  </div>
                )}
                <Link
                  href="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:bg-white/5 transition-colors"
                  role="menuitem"
                  tabIndex={0}
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors"
                  role="menuitem"
                  tabIndex={0}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* AI Chat Drawer Panel */}
      <AiChatPanel open={showAiChat} onClose={() => setShowAiChat(false)} projectId={activeProjectId} />

      {/* Command Palette */}
      {showCommandPalette && (
        <CommandPalette onClose={() => setShowCommandPalette(false)} activeProjectId={activeProjectId} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Primary action button (consistent page shell across list/detail pages)
// ---------------------------------------------------------------------------

const PRIMARY_ACTION_CLASSES =
  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed';
const PRIMARY_ACTION_STYLE = { background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' } as const;

function PrimaryActionButton({ action }: { action: HeaderPrimaryAction }) {
  const Icon = action.icon;

  if (action.href && !action.disabled) {
    return (
      <Link href={action.href} className={PRIMARY_ACTION_CLASSES} style={PRIMARY_ACTION_STYLE}>
        {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
        {action.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={PRIMARY_ACTION_CLASSES}
      style={PRIMARY_ACTION_STYLE}
    >
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {action.label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline Command Palette (keeps everything in one file for simplicity)
// ---------------------------------------------------------------------------

import {
  LayoutDashboard, Brain, HeartPulse, Clock, GitCompare,
  FolderGit2, ShieldAlert, Lightbulb, Network, BarChart3,
  Layers, Calendar, FileText, FlaskConical, Bot, Camera,
  Users, Shield, History, Key, Eye, Webhook, Package, KeyRound, Building2, Zap,
  Target, Boxes, Cloud, Mail, Handshake
} from 'lucide-react';

interface CommandItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'Pages' | 'Actions';
}

const COMMAND_ITEMS: CommandItem[] = [
  // Intelligence
  { label: 'Overview', href: '/', icon: LayoutDashboard, group: 'Pages' },
  { label: 'Forecasting', href: '/forecasting', icon: Brain, group: 'Pages' },
  { label: 'Confidence', href: '/confidence', icon: Target, group: 'Pages' },
  { label: 'Health', href: '/health', icon: HeartPulse, group: 'Pages' },
  { label: 'Timeline', href: '/timeline', icon: Clock, group: 'Pages' },
  { label: 'Comparisons', href: '/comparisons', icon: GitCompare, group: 'Pages' },
  { label: 'Intelligence Packs', href: '/intelligence-packs', icon: Boxes, group: 'Pages' },
  // Analysis
  { label: 'Projects', href: '/projects', icon: FolderGit2, group: 'Pages' },
  { label: 'Findings', href: '/findings', icon: ShieldAlert, group: 'Pages' },
  { label: 'Opportunities', href: '/opportunities', icon: Lightbulb, group: 'Pages' },
  { label: 'System Map', href: '/system-map', icon: Network, group: 'Pages' },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, group: 'Pages' },
  // Operations
  { label: 'Batch', href: '/batch', icon: Layers, group: 'Pages' },
  { label: 'Scheduling', href: '/scheduling', icon: Calendar, group: 'Pages' },
  { label: 'Reports', href: '/reports', icon: FileText, group: 'Pages' },
  { label: 'Experiments', href: '/experiments', icon: FlaskConical, group: 'Pages' },
  { label: 'Simulation', href: '/simulation', icon: Bot, group: 'Pages' },
  { label: 'Snapshots', href: '/snapshots', icon: Camera, group: 'Pages' },
  // Administration
  { label: 'Users', href: '/users', icon: Users, group: 'Pages' },
  { label: 'Invites', href: '/invites', icon: Mail, group: 'Pages' },
  { label: 'Policies', href: '/policies', icon: Shield, group: 'Pages' },
  { label: 'Audit Trail', href: '/audit', icon: History, group: 'Pages' },
  { label: 'Settings', href: '/settings', icon: Settings, group: 'Pages' },
  { label: 'Secrets', href: '/secrets', icon: Key, group: 'Pages' },
  { label: 'Data Masking', href: '/data-masking', icon: Eye, group: 'Pages' },
  { label: 'Webhooks', href: '/webhooks', icon: Webhook, group: 'Pages' },
  { label: 'Notifications', href: '/notifications', icon: Bell, group: 'Pages' },
  { label: 'Marketplace', href: '/marketplace', icon: Zap, group: 'Pages' },
  { label: 'Plugins', href: '/plugins', icon: Package, group: 'Pages' },
  { label: 'Partners', href: '/partners', icon: Handshake, group: 'Pages' },
  { label: 'Cloud', href: '/cloud', icon: Cloud, group: 'Pages' },
  { label: 'SSO', href: '/sso', icon: KeyRound, group: 'Pages' },
  { label: 'Tenants', href: '/tenants', icon: Building2, group: 'Pages' },
  // Actions
  { label: 'Run Analysis', href: '/projects', icon: FolderGit2, group: 'Actions' },
  { label: 'Create Project', href: '/projects', icon: FolderGit2, group: 'Actions' },
  { label: 'Export Report', href: '/reports', icon: FileText, group: 'Actions' },
  { label: 'Search Findings', href: '/search', icon: Search, group: 'Actions' },
];

function CommandPalette({ onClose, activeProjectId }: { onClose: () => void; activeProjectId?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? COMMAND_ITEMS.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase())
      )
    : COMMAND_ITEMS;

  const groups = ['Pages', 'Actions'] as const;

  // Focus the search input on open; restore focus to the opener on close.
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => {
      previousFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Trap Tab focus inside the modal dialog while it is open.
  useEffect(() => {
    function trapFocus(e: globalThis.KeyboardEvent) {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !dialogRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialogRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, []);

  const handleSelect = useCallback((item: CommandItem) => {
    onClose();
    // Preserve the active project scope so navigating via the palette doesn't
    // silently drop the selected project (which would auto-pick the first one).
    const scope = activeProjectId && item.href !== '/projects'
      ? `${item.href.includes('?') ? '&' : '?'}projectId=${encodeURIComponent(activeProjectId)}`
      : '';
    router.push(`${item.href}${scope}`);
  }, [onClose, router, activeProjectId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      handleSelect(filtered[selectedIdx]);
    }
  };

  let itemIndex = -1;

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        className="fixed left-1/2 top-[15%] z-[80] w-full max-w-xl -translate-x-1/2 glass-card overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Search className="h-4 w-4 text-text-muted shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, actions…"
            aria-label="Search commands"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          <kbd className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-text-muted">ESC</kbd>
        </div>
        <div className="max-h-[400px] overflow-y-auto py-2" role="listbox">
          {groups.map(group => {
            const items = filtered.filter(i => i.group === group);
            if (!items.length) return null;
            return (
              <div key={group}>
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                  {group}
                </div>
                {items.map(item => {
                  itemIndex++;
                  const isSelected = itemIndex === selectedIdx;
                  const Icon = item.icon;
                  const currentIndex = itemIndex;
                  return (
                    <button
                      key={`${item.group}-${item.label}`}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIdx(currentIndex)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                        isSelected ? 'bg-white/8 text-text-primary' : 'text-text-secondary hover:bg-white/5'
                      }`}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </div>
    </>
  );
}
