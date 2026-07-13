import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  Shield,
  Zap,
  FileText,
  MapPin,
  Lightbulb,
  Tag,
  Clock,
  Activity,
  ChevronRight,
} from "lucide-react";
import { getFinding } from "@/lib/api";

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

function getSeverityStyle(severity: string) {
  const styles: Record<string, { bg: string; text: string; dot: string }> = {
    critical: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
    high: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
    medium: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
    low: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400" },
    info: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  };
  return styles[severity] ?? styles.medium!;
}

function getCategoryStyle(category: string) {
  const styles: Record<string, { color: string; bg: string }> = {
    security: { color: "text-red-400", bg: "bg-red-500/10" },
    performance: { color: "text-blue-400", bg: "bg-blue-500/10" },
    architecture: { color: "text-purple-400", bg: "bg-purple-500/10" },
    reliability: { color: "text-cyan-400", bg: "bg-cyan-500/10" },
    cost: { color: "text-amber-400", bg: "bg-amber-500/10" },
    documentation: { color: "text-green-400", bg: "bg-green-500/10" },
    ai_quality: { color: "text-pink-400", bg: "bg-pink-500/10" },
    ux: { color: "text-indigo-400", bg: "bg-indigo-500/10" },
  };
  return styles[category] ?? { color: "text-text-secondary", bg: "bg-white/5" };
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return "text-green-400";
  if (confidence >= 0.7) return "text-blue-400";
  if (confidence >= 0.5) return "text-amber-400";
  return "text-red-400";
}

function getConfidenceBarColor(confidence: number): string {
  if (confidence >= 0.9) return "bg-green-500";
  if (confidence >= 0.7) return "bg-blue-500";
  if (confidence >= 0.5) return "bg-amber-500";
  return "bg-red-500";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface FindingDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ projectId?: string }>;
}

export default async function FindingDetailPage({ params, searchParams }: FindingDetailPageProps) {
  const { id } = await params;
  const { projectId } = await searchParams;
  if (!projectId) return null;
  const finding = await getFinding(id, projectId);

  if (!finding) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="rounded-2xl bg-white/5 p-6">
          <AlertCircle className="h-10 w-10 text-text-muted" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">
          Finding Not Found
        </h2>
        <p className="text-sm text-text-muted max-w-xs text-center">
          The finding <span className="text-text-secondary font-mono">{id}</span> could
          not be found. It may have been resolved or removed.
        </p>
        <Link
          href={`/insights?projectId=${encodeURIComponent(projectId)}`}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-accent-blue/10 border border-accent-blue/30 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-accent-blue/20 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Insights
        </Link>
      </div>
    );
  }

  const sev = getSeverityStyle(finding.severity);
  const cat = getCategoryStyle(finding.category);
  const confidencePct = Math.round(finding.confidence * 100);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto animate-fade-in-up">
      {/* ── Breadcrumb ─────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-sm text-text-muted">
        <Link
          href={`/insights?projectId=${encodeURIComponent(projectId)}`}
          className="inline-flex items-center gap-1.5 hover:text-text-secondary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Insights
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-text-secondary">Finding Detail</span>
      </nav>

      {/* ── Header ─────────────────────────────────────── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {/* Category badge */}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cat.bg} ${cat.color} border border-current/20`}
              >
                {finding.category.replace(/_/g, " ")}
              </span>
              {/* Severity badge */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${sev.bg} ${sev.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                {finding.severity}
              </span>
              {/* Analyzer badge */}
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-white/5 text-text-muted border border-white/5">
                <Activity className="h-2.5 w-2.5" />
                {finding.analyzer_id}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-text-primary leading-snug">
              {finding.title}
            </h1>
          </div>

          {/* Confidence Score */}
          <div className="shrink-0 flex flex-col items-center gap-1 rounded-2xl bg-white/[0.03] border border-white/5 p-4 min-w-[100px]">
            <span className="text-xs text-text-muted font-medium uppercase tracking-wider">
              Confidence
            </span>
            <span className={`text-3xl font-bold tabular-nums ${getConfidenceColor(finding.confidence)}`}>
              {confidencePct}%
            </span>
            <div className="h-1.5 w-16 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full ${getConfidenceBarColor(finding.confidence)}`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Date & ID info */}
        <div className="flex items-center gap-4 text-xs text-text-muted pt-2 border-t border-white/5">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(finding.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span className="font-mono">{finding.id.slice(0, 8)}…</span>
        </div>
      </div>

      {/* ── Description ────────────────────────────────── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-text-primary">Description</h2>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
          {finding.description}
        </p>
      </div>

      {/* ── Two-column layout: Locations + Evidence ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Locations */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-text-primary">Locations</h2>
            <span className="ml-auto text-xs text-text-muted">
              {finding.locations.length} location{finding.locations.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {finding.locations.length > 0 ? (
              finding.locations.map((loc, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg bg-white/[0.02] border border-white/5 p-3"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-[10px] font-bold text-cyan-400">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-text-primary truncate">
                      {loc.file}
                    </p>
                    {(loc.start_line != null) && (
                      <p className="mt-0.5 text-[10px] text-text-muted">
                        Line {loc.start_line}
                        {loc.end_line && loc.end_line !== loc.start_line
                          ? `–${loc.end_line}`
                          : ""}
                        {loc.start_column != null ? `, col ${loc.start_column}` : ""}
                      </p>
                    )}
                    {loc.repository && (
                      <p className="mt-0.5 text-[10px] text-text-muted truncate">
                        Repo: {loc.repository}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-text-muted italic">No source locations identified.</p>
            )}
          </div>
        </div>

        {/* Evidence */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-text-primary">Evidence</h2>
            <span className="ml-auto text-xs text-text-muted">
              {finding.evidence.length} item{finding.evidence.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {finding.evidence.length > 0 ? (
              finding.evidence.map((ev, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-white/[0.02] border border-white/5 p-3"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-blue/10 text-blue-400 border border-blue-500/20">
                      {ev.type}
                    </span>
                    <span className="text-[10px] text-text-muted truncate">{ev.source}</span>
                    <span className="ml-auto text-[10px] text-text-muted tabular-nums">
                      {Math.round(ev.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">{ev.description}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-text-muted italic">No evidence collected yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Suggested Fix / Recommendation ──────────── */}
      {finding.suggested_fix && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-text-primary">Recommendation</h2>
          </div>
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-4">
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {finding.suggested_fix}
            </p>
          </div>
        </div>
      )}

      {/* ── Estimated Impact ─────────────────────────── */}
      {finding.estimated_impact && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-text-primary">Estimated Impact</h2>
          </div>

          {finding.estimated_impact.summary && (
            <p className="text-sm text-text-secondary leading-relaxed mb-4">
              {finding.estimated_impact.summary}
            </p>
          )}

          {/* Impact metrics */}
          {finding.estimated_impact.metrics && finding.estimated_impact.metrics.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {finding.estimated_impact.metrics.map((metric, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-white/[0.02] border border-white/5 p-3 text-center"
                >
                  <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{metric.name}</p>
                  <div className="flex items-center justify-center gap-2">
                    {metric.current_value != null && (
                      <span className="text-sm text-text-secondary">{String(metric.current_value)}</span>
                    )}
                    {metric.current_value != null && metric.expected_value != null && (
                      <span className="text-text-muted">→</span>
                    )}
                    {metric.expected_value != null && (
                      <span className="text-sm font-medium text-text-primary">{String(metric.expected_value)}</span>
                    )}
                  </div>
                  {metric.change_percent != null && (
                    <p className={`text-xs mt-1 ${metric.change_percent > 0 ? "text-green-400" : metric.change_percent < 0 ? "text-red-400" : "text-text-muted"}`}>
                      {metric.change_percent > 0 ? "+" : ""}{metric.change_percent}%
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Affected services */}
          {finding.estimated_impact.affected_services && finding.estimated_impact.affected_services.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {finding.estimated_impact.affected_services.map((service) => (
                <span
                  key={service}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-3 py-1.5 text-xs font-medium text-text-secondary"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-purple" />
                  {service}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tags ──────────────────────────────────────── */}
      {finding.tags.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-4 w-4 text-green-400" />
            <h2 className="text-sm font-semibold text-text-primary">Tags</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {finding.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-white/5 border border-white/5 px-3 py-1 text-xs font-medium text-text-secondary hover:bg-white/8 transition-colors"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
