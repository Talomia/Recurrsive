"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Bell, Sparkles, LogOut, User, Settings } from "lucide-react";
import { useWebSocket } from "../hooks/useWebSocket";
import { LiveIndicator } from "./LiveIndicator";
import { useAuth } from "@/lib/auth-context";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

/** Map role to display color. */
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: 'rgba(139, 92, 246, 0.15)', text: '#a78bfa' },
  analyst: { bg: 'rgba(59, 130, 246, 0.15)', text: '#93bbfd' },
  viewer: { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af' },
};

export default function Header({ title, subtitle }: HeaderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const notifButtonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showUserMenu && !showNotifications) return;
    function handleClickOutside(e: MouseEvent) {
      if (showUserMenu && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (showNotifications && notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu, showNotifications]);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Escape to close any open panel
      if (e.key === 'Escape') {
        if (showUserMenu) {
          setShowUserMenu(false);
          menuButtonRef.current?.focus();
        }
        if (showNotifications) {
          setShowNotifications(false);
          notifButtonRef.current?.focus();
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
  }, [showUserMenu, showNotifications, showAiChat, showCommandPalette]);

  const { status, clientCount } = useWebSocket({ autoConnect: true });
  const { user, logout } = useAuth();

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
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
        {/* Left: title */}
        <div>
          <h1 className="text-xl font-bold text-text-primary">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>
          )}
        </div>

        {/* Right: search + actions */}
        <div className="flex items-center gap-3">
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

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              ref={notifButtonRef}
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
              aria-label="View notifications"
              aria-expanded={showNotifications}
              aria-haspopup="true"
            >
              <Bell className="h-4 w-4 text-text-secondary" aria-hidden="true" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent-blue animate-pulse-dot" aria-hidden="true" />
            </button>

            {/* Notifications dropdown */}
            {showNotifications && (
              <div
                className="absolute right-0 top-full mt-1 w-80 rounded-xl overflow-hidden z-50 glass-card"
                role="dialog"
                aria-label="Notifications"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <h2 className="text-sm font-semibold text-text-primary">Notifications</h2>
                  <button className="text-[11px] text-accent-blue hover:underline">Mark all read</button>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  <div className="px-4 py-8 text-center">
                    <Bell className="h-6 w-6 text-text-muted mx-auto mb-2" aria-hidden="true" />
                    <p className="text-xs text-text-muted">No new notifications</p>
                  </div>
                </div>
                <div className="border-t border-white/10 px-4 py-2">
                  <Link
                    href="/notifications"
                    onClick={() => setShowNotifications(false)}
                    className="text-[11px] text-accent-blue hover:underline"
                  >
                    View all notifications →
                  </Link>
                </div>
              </div>
            )}
          </div>

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

      {/* AI Chat Panel */}
      {showAiChat && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAiChat(false)}
          />
          <aside
            className="fixed right-0 top-0 z-50 h-full w-full max-w-[400px] flex flex-col border-l border-white/10"
            style={{ background: 'var(--color-surface)' }}
            role="dialog"
            aria-label="AI Assistant"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-text-primary">Recurrsive AI</h2>
              </div>
              <button
                onClick={() => setShowAiChat(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Close AI assistant"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-500/20">
                  <Sparkles className="h-4 w-4 text-purple-400" aria-hidden="true" />
                </div>
                <div className="glass-card px-3 py-2 text-sm text-text-secondary max-w-[280px]">
                  Hi! I&apos;m Recurrsive AI. I can help you understand your codebase analysis, explain findings, and suggest improvements. What would you like to know?
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 p-3">
              <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/5 focus-within:border-accent-purple/40 transition-colors">
                <input
                  type="text"
                  placeholder="Ask about your codebase…"
                  aria-label="AI chat message"
                  className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                />
                <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-purple/20 hover:bg-accent-purple/30 transition-colors" aria-label="Send message">
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" aria-hidden="true" />
                </button>
              </div>
              <p className="text-[10px] text-text-muted mt-1.5 text-center">AI assistant is in preview — responses are illustrative</p>
            </div>
          </aside>
        </>
      )}

      {/* Command Palette */}
      {showCommandPalette && (
        <CommandPalette onClose={() => setShowCommandPalette(false)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Inline Command Palette (keeps everything in one file for simplicity)
// ---------------------------------------------------------------------------

import {
  LayoutDashboard, Brain, HeartPulse, Clock, GitCompare,
  FolderGit2, ShieldAlert, Lightbulb, Network, BarChart3,
  Layers, Calendar, FileText, FlaskConical, Bot, Camera,
  Users, Shield, History, Key, Eye, Webhook, Package, KeyRound, Building2, Zap
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
  { label: 'Health', href: '/health', icon: HeartPulse, group: 'Pages' },
  { label: 'Timeline', href: '/timeline', icon: Clock, group: 'Pages' },
  { label: 'Comparisons', href: '/comparisons', icon: GitCompare, group: 'Pages' },
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
  { label: 'Policies', href: '/policies', icon: Shield, group: 'Pages' },
  { label: 'Audit Trail', href: '/audit', icon: History, group: 'Pages' },
  { label: 'Settings', href: '/settings', icon: Settings, group: 'Pages' },
  { label: 'Secrets', href: '/secrets', icon: Key, group: 'Pages' },
  { label: 'Data Masking', href: '/data-masking', icon: Eye, group: 'Pages' },
  { label: 'Webhooks', href: '/webhooks', icon: Webhook, group: 'Pages' },
  { label: 'Notifications', href: '/notifications', icon: Bell, group: 'Pages' },
  { label: 'Marketplace', href: '/marketplace', icon: Zap, group: 'Pages' },
  { label: 'Plugins', href: '/plugins', icon: Package, group: 'Pages' },
  { label: 'SSO', href: '/sso', icon: KeyRound, group: 'Pages' },
  { label: 'Tenants', href: '/tenants', icon: Building2, group: 'Pages' },
  // Actions
  { label: 'Run Analysis', href: '/projects', icon: FolderGit2, group: 'Actions' },
  { label: 'Create Project', href: '/projects', icon: FolderGit2, group: 'Actions' },
  { label: 'Export Report', href: '/reports', icon: FileText, group: 'Actions' },
  { label: 'Search Findings', href: '/search', icon: Search, group: 'Actions' },
];

function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? COMMAND_ITEMS.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase())
      )
    : COMMAND_ITEMS;

  const groups = ['Pages', 'Actions'] as const;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleSelect = useCallback((item: CommandItem) => {
    onClose();
    router.push(item.href);
  }, [onClose, router]);

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
        className="fixed left-1/2 top-[15%] z-[80] w-full max-w-xl -translate-x-1/2 glass-card overflow-hidden"
        role="dialog"
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
