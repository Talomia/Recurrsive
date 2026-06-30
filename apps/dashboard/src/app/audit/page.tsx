"use client";

import { useEffect, useState } from "react";
import Header from "@/components/header";
import { getAuditLog } from "@/lib/api";
import type { AuditEvent, AuditEventType } from "@/lib/api";
import {
  Zap,
  Webhook,
  Settings,
  Bell,
  Layers,
  Shield,
  ChevronDown,
  User,
  Clock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Type icon mapping
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<string, typeof Zap> = {
  analysis: Zap,
  webhook: Webhook,
  config: Settings,
  notification: Bell,
  batch: Layers,
  policy: Shield,
};

const TYPE_COLORS: Record<string, { text: string; bg: string }> = {
  analysis: { text: "text-accent", bg: "bg-accent/10" },
  webhook: { text: "text-blue-400", bg: "bg-blue-500/10" },
  config: { text: "text-amber-400", bg: "bg-amber-500/10" },
  notification: { text: "text-purple-400", bg: "bg-purple-500/10" },
  batch: { text: "text-cyan-400", bg: "bg-cyan-500/10" },
  policy: { text: "text-emerald-400", bg: "bg-emerald-500/10" },
};

const ACTION_LABELS: Record<string, { text: string; color: string }> = {
  created: { text: "Created", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  updated: { text: "Updated", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  deleted: { text: "Deleted", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  executed: { text: "Executed", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  tested: { text: "Tested", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  configured: { text: "Configured", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
};

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  try {
    const seconds = Math.floor(
      (Date.now() - new Date(dateStr).getTime()) / 1000,
    );
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Filter dropdown options
// ---------------------------------------------------------------------------

const FILTER_OPTIONS: { value: AuditEventType | "all"; label: string }[] = [
  { value: "all", label: "All Events" },
  { value: "analysis", label: "Analysis" },
  { value: "webhook", label: "Webhook" },
  { value: "config", label: "Config" },
  { value: "notification", label: "Notification" },
  { value: "batch", label: "Batch" },
  { value: "policy", label: "Policy" },
];

// ---------------------------------------------------------------------------
// Audit event row
// ---------------------------------------------------------------------------

function AuditEventRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = useState(false);
  const typeColors = TYPE_COLORS[event.type] ?? {
    text: "text-text-secondary",
    bg: "bg-white/5",
  };
  const Icon = TYPE_ICONS[event.type] ?? Zap;
  const actionConfig = ACTION_LABELS[event.action] ?? {
    text: event.action,
    color: "text-text-muted bg-white/5 border-white/10",
  };

  return (
    <div className="group border-b border-white/5 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        {/* Type icon */}
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeColors.bg}`}
        >
          <Icon className={`w-4 h-4 ${typeColors.text}`} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Action badge */}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${actionConfig.color}`}
            >
              {actionConfig.text}
            </span>

            {/* Target */}
            <span className="text-sm font-medium text-text-primary truncate">
              {event.target}
            </span>
          </div>

          {/* Actor + timestamp row */}
          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <User className="w-3 h-3" />
              {event.actor}
            </span>
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Clock className="w-3 h-3" />
              {timeAgo(event.timestamp)}
            </span>
          </div>
        </div>

        {/* Type label */}
        <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider hidden sm:block">
          {event.type}
        </span>

        {/* Expand chevron */}
        <ChevronDown
          className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-4 pl-[52px]">
          <div className="rounded-xl bg-white/[0.02] border border-white/5 px-4 py-3 space-y-2">
            <div>
              <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                Details
              </span>
              <p className="text-xs text-text-secondary mt-0.5">
                {event.details || "No additional details."}
              </p>
            </div>
            <div className="flex gap-6 flex-wrap">
              <div>
                <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                  IP Address
                </span>
                <p className="text-xs text-text-secondary font-mono mt-0.5">
                  {event.ip}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                  Timestamp
                </span>
                <p className="text-xs text-text-secondary mt-0.5">
                  {new Date(event.timestamp).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                  Event ID
                </span>
                <p className="text-xs text-text-secondary font-mono mt-0.5">
                  {event.id}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState<AuditEventType | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getAuditLog(filter === "all" ? undefined : filter)
      .then(setEvents)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load audit log");
      })
      .finally(() => setLoading(false));
  }, [filter]);

  const filteredEvents =
    filter === "all"
      ? events
      : events.filter((e) => e.type === filter);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <Header
          title="Audit Trail"
          subtitle={`${filteredEvents.length} events recorded`}
        />

        {/* Filter dropdown */}
        <div className="relative mt-4">
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as AuditEventType | "all")
            }
            className="appearance-none rounded-xl bg-white/5 border border-white/10 px-4 py-2 pr-9 text-sm text-text-primary hover:bg-white/8 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/50"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-5 py-4 flex items-center gap-3">
          <Zap className="h-5 w-5 text-red-400 flex-none" />
          <div>
            <p className="text-sm font-medium text-red-400">
              Failed to load audit trail
            </p>
            <p className="text-xs text-text-muted mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
        </div>
      )}

      {/* Event list */}
      {!loading && filteredEvents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-4">
            <Shield className="h-8 w-8 text-white/30" />
          </div>
          <h3 className="text-sm font-medium text-text-primary mb-1">
            No Audit Events
          </h3>
          <p className="text-xs text-text-muted max-w-xs">
            {filter === "all"
              ? "No audit events have been recorded yet."
              : `No ${filter} events found. Try a different filter.`}
          </p>
        </div>
      )}

      {!loading && filteredEvents.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              Event Log
            </h3>
            <span className="text-xs text-white/40">
              {filteredEvents.length} events
            </span>
          </div>
          <div className="divide-y divide-white/5">
            {filteredEvents.map((event) => (
              <AuditEventRow key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
