"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Filter, ShieldAlert, AlertTriangle, AlertCircle, CheckCircle2, EyeOff } from "lucide-react";
import Header from "@/components/header";
import EmptyState from "@/components/ui/empty-state";
import ErrorState from "@/components/ui/error-state";
import LoadingSkeleton from "@/components/loading-skeleton";
import { getFindingsPage, type FindingsPageData } from "@/lib/api";
import clsx from "clsx";

// ---------------------------------------------------------------------------
// Severity styling
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  critical: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400", border: "border-red-500/20" },
  high: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400", border: "border-orange-500/20" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400", border: "border-amber-500/20" },
  low: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400", border: "border-green-500/20" },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; icon: typeof CheckCircle2 }> = {
  open: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", icon: AlertCircle },
  resolved: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20", icon: CheckCircle2 },
  suppressed: { bg: "bg-white/5", text: "text-text-muted", border: "border-white/10", icon: EyeOff },
};

const SEVERITY_OPTIONS = ["All Severities", "critical", "high", "medium", "low"] as const;
const STATUS_OPTIONS = ["All Statuses", "open", "resolved", "suppressed"] as const;

export default function FindingsPage() {
  const searchParams = useSearchParams();
  // Key the fetch on the active project so switching projects (a query-string
  // change) actually refetches instead of showing the first project's data.
  const projectId = searchParams.get("projectId");

  const [data, setData] = useState<FindingsPageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All Severities");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    getFindingsPage()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => {
        // Distinguish a server error from a genuinely empty result set.
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load findings");
      });
    return () => { cancelled = true; };
  }, [projectId, reloadKey]);

  // NOTE: all hooks must run unconditionally before any early return.
  const filtered = useMemo(() => {
    if (!data) return [];
    let result = data.findings;

    if (severityFilter !== "All Severities") {
      result = result.filter((f) => f.severity === severityFilter);
    }
    if (statusFilter !== "All Statuses") {
      result = result.filter((f) => f.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.id.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q) ||
          f.assignee.toLowerCase().includes(q)
      );
    }
    return result;
  }, [data, search, severityFilter, statusFilter]);

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Header title="Security Findings" subtitle="Couldn't load findings" />
        <ErrorState
          title="Failed to load findings"
          message={error}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Header title="Security Findings" subtitle="Loading findings data…" />
        <LoadingSkeleton variant="table" count={6} />
      </div>
    );
  }

  const stats = [
    { label: "Total", value: data.stats.total, color: "text-text-primary", bg: "bg-blue-500/10", icon: ShieldAlert, iconColor: "text-blue-400" },
    { label: "Critical", value: data.stats.critical, color: "text-red-400", bg: "bg-red-500/10", icon: AlertTriangle, iconColor: "text-red-400" },
    { label: "High", value: data.stats.high, color: "text-orange-400", bg: "bg-orange-500/10", icon: AlertCircle, iconColor: "text-orange-400" },
    { label: "Medium", value: data.stats.medium, color: "text-amber-400", bg: "bg-amber-500/10", icon: AlertCircle, iconColor: "text-amber-400" },
    { label: "Low", value: data.stats.low, color: "text-green-400", bg: "bg-green-500/10", icon: CheckCircle2, iconColor: "text-green-400" },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header
        title="Security Findings"
        subtitle={`${data.stats.total} findings across your codebase`}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {stats.map(({ label, value, color, icon: Icon, iconColor }) => (
          <div key={label} className="glass-card flex flex-col items-center justify-center p-5 gap-2">
            <Icon className={`h-5 w-5 ${iconColor}`} />
            <span className={`text-2xl font-bold tabular-nums ${color}`}>
              {value}
            </span>
            <span className="text-[11px] text-text-muted font-medium">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/5 focus-within:border-accent-blue/40 transition-colors flex-1 max-w-md">
          <Search className="h-4 w-4 text-text-muted shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search findings…"
            aria-label="Search findings"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const idx = SEVERITY_OPTIONS.indexOf(severityFilter as typeof SEVERITY_OPTIONS[number]);
              setSeverityFilter(SEVERITY_OPTIONS[(idx + 1) % SEVERITY_OPTIONS.length]!);
            }}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
              severityFilter !== "All Severities"
                ? "bg-accent-blue/10 border-accent-blue/30 text-blue-400"
                : "bg-white/5 border-white/5 text-text-secondary hover:bg-white/8"
            )}
          >
            <Filter className="h-3 w-3" />
            {severityFilter === "All Severities" ? "Severity" : severityFilter.charAt(0).toUpperCase() + severityFilter.slice(1)}
          </button>
          <button
            onClick={() => {
              const idx = STATUS_OPTIONS.indexOf(statusFilter as typeof STATUS_OPTIONS[number]);
              setStatusFilter(STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length]!);
            }}
            className={clsx(
              "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
              statusFilter !== "All Statuses"
                ? "bg-accent-blue/10 border-accent-blue/30 text-blue-400"
                : "bg-white/5 border-white/5 text-text-secondary hover:bg-white/8"
            )}
          >
            {statusFilter === "All Statuses" ? "Status" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
          </button>
        </div>
        <span className="text-xs text-text-muted">
          {filtered.length} results
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-[11px] font-medium text-text-muted px-5 py-3">ID</th>
              <th className="text-left text-[11px] font-medium text-text-muted px-5 py-3">Title</th>
              <th className="text-left text-[11px] font-medium text-text-muted px-5 py-3 hidden sm:table-cell">Severity</th>
              <th className="text-left text-[11px] font-medium text-text-muted px-5 py-3 hidden md:table-cell">Category</th>
              <th className="text-left text-[11px] font-medium text-text-muted px-5 py-3 hidden lg:table-cell">Status</th>
              <th className="text-left text-[11px] font-medium text-text-muted px-5 py-3 hidden xl:table-cell">Assignee</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((finding) => {
              const sev = SEVERITY_STYLES[finding.severity] ?? SEVERITY_STYLES.medium!;
              const stat = STATUS_STYLES[finding.status] ?? STATUS_STYLES.open!;
              const StatusIcon = stat.icon;

              return (
                <tr
                  key={finding.id}
                  className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                >
                  <td className="px-5 py-3">
                    <Link href={`/findings/${finding.id}`} className="text-xs font-mono text-text-muted group-hover:text-accent-blue transition-colors">{finding.id}</Link>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/findings/${finding.id}`} className="text-xs font-medium text-text-primary truncate max-w-xs block group-hover:text-accent-blue transition-colors">
                      {finding.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${sev.bg} ${sev.text} border ${sev.border}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                      {finding.severity}
                    </span>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <span className="text-xs text-text-secondary">{finding.category}</span>
                  </td>
                  <td className="px-5 py-3 hidden lg:table-cell">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${stat.bg} ${stat.text} ${stat.border}`}>
                      <StatusIcon className="h-3 w-3" />
                      {finding.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 hidden xl:table-cell">
                    <span className="text-xs text-text-secondary">{finding.assignee}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && data.stats.total === 0 && (
          <EmptyState
            icon={ShieldAlert}
            title="No findings yet"
            description="Run an analysis on your project to discover security findings, code quality issues, and improvement opportunities."
            action={{ label: 'Go to Projects', href: '/projects' }}
          />
        )}
        {filtered.length === 0 && data.stats.total > 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldAlert className="h-8 w-8 text-text-muted mb-3" />
            <p className="text-sm text-text-muted">No findings match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
