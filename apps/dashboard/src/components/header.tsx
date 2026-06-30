"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, Sparkles } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

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

        {/* Avatar */}
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple text-xs font-bold text-white"
          role="img"
          aria-label="User avatar"
        >
          RC
        </div>
      </div>
    </header>
  );
}
