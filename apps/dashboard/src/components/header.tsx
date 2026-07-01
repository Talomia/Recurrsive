"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, Sparkles, LogOut } from "lucide-react";
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

  const initials = user
    ? user.username.slice(0, 2).toUpperCase()
    : 'RC';

  const roleStyle = user
    ? ROLE_COLORS[user.role] ?? ROLE_COLORS.viewer
    : ROLE_COLORS.viewer;

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4">
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
          <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
            ⌘K
          </kbd>
        </div>

        {/* Live status */}
        <LiveIndicator status={status} clientCount={clientCount} showClientCount size="sm" />

        {/* AI chip */}
        <button
          className="hidden sm:flex items-center gap-1.5 rounded-xl bg-accent-purple/10 px-3 py-2 text-xs font-medium text-purple-400 border border-purple-500/20 hover:bg-accent-purple/20 transition-colors"
          aria-label="AI Assist"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          AI Assist
        </button>

        {/* Notifications */}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
          aria-label="View notifications"
        >
          <Bell className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent-blue animate-pulse-dot" aria-hidden="true" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/5 transition-colors"
            aria-label="User menu"
            aria-expanded={showUserMenu}
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
            <div className="absolute right-0 top-full mt-1 w-48 rounded-xl overflow-hidden z-50"
                 style={{
                   background: 'var(--color-surface)',
                   border: '1px solid var(--color-border)',
                   boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
                 }}>
              {user && (
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-sm font-medium text-text-primary">{user.username}</p>
                  <p className="text-xs text-text-secondary">{user.role} · {user.userId.slice(0, 8)}</p>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

