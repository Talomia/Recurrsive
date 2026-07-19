import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  Zap,
  AlertCircle,
  FileText,
  Target,
  Layers,
  Wrench,
} from "lucide-react";
import Header from "@/components/header";
import { getOpportunity, type Opportunity } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { scopedHref } from "@/lib/project-links";
import OpportunityActions from "./opportunity-actions";

// ---------------------------------------------------------------------------
// Real-metric display helpers
// ---------------------------------------------------------------------------

/** Confidence is 0–1 from the server; render as a percentage. */
function formatConfidence(confidence: number | null): string {
  return confidence == null ? "—" : `${Math.round(confidence * 100)}%`;
}

function confidenceColor(confidence: number | null): string {
  if (confidence == null) return "text-text-muted";
  if (confidence >= 0.8) return "text-green-400";
  if (confidence >= 0.6) return "text-blue-400";
  if (confidence >= 0.4) return "text-amber-400";
  return "text-red-400";
}

function formatEffort(effort: Opportunity["effort"]): string {
  if (!effort) return "—";
  const size = effort.tShirt.toUpperCase();
  return effort.estimatedHours != null ? `${size} · ${effort.estimatedHours}h` : size;
}

function effortColor(effort: Opportunity["effort"]): string {
  if (!effort) return "text-text-muted";
  const t = effort.tShirt.toLowerCase();
  if (t === "xs" || t === "s") return "text-green-400";
  if (t === "m") return "text-amber-400";
  return "text-red-400";
}

function riskColor(level: string | null): string {
  switch (level) {
    case "critical": return "text-red-400";
    case "high": return "text-orange-400";
    case "medium": return "text-amber-400";
    case "low":
    case "negligible": return "text-green-400";
    default: return "text-text-muted";
  }
}

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

/** Composite score displayed on a 0–100 scale (server sends 0–1). */
function getScoreColor(scorePct: number): string {
  if (scorePct >= 90) return "text-red-400";
  if (scorePct >= 75) return "text-orange-400";
  if (scorePct >= 60) return "text-amber-400";
  return "text-blue-400";
}

function getScoreBarColor(scorePct: number): string {
  if (scorePct >= 90) return "bg-red-500";
  if (scorePct >= 75) return "bg-orange-500";
  return "bg-amber-500";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface OpportunityDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ projectId?: string }>;
}

export default async function OpportunityDetailPage({ params, searchParams }: OpportunityDetailPageProps) {
  const { id } = await params;
  const { projectId } = await searchParams;
  const opportunity = await getOpportunity(id);

  const listHref = scopedHref("/opportunities", projectId ?? null);

  if (!opportunity) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header
          title="Opportunity Detail"
          breadcrumbs={[{ label: "Opportunities", href: listHref }, { label: `#${id}` }]}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <div className="rounded-2xl bg-white/5 p-6">
            <AlertCircle className="h-10 w-10 text-text-muted" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">
            Opportunity Not Found
          </h2>
          <p className="text-sm text-text-muted max-w-xs text-center">
            The opportunity <span className="text-text-secondary font-mono">{id}</span> could
            not be found. It may have been resolved or removed.
          </p>
          <Link
            href={listHref}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-accent-blue/10 border border-accent-blue/30 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-accent-blue/20 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Opportunities
          </Link>
        </div>
      </div>
    );
  }

  // Real server facts only — confidence (0–1), t-shirt effort, risk level.
  const metrics = [
    { label: "Confidence", value: formatConfidence(opportunity.confidence), color: confidenceColor(opportunity.confidence), icon: Shield },
    { label: "Effort", value: formatEffort(opportunity.effort), color: effortColor(opportunity.effort), icon: Zap },
    { label: "Risk", value: opportunity.riskLevel ?? "—", color: riskColor(opportunity.riskLevel), icon: AlertCircle },
  ];

  const sev = getSeverityStyle(opportunity.severity);
  const scorePct = opportunity.score != null ? Math.round(opportunity.score * 100) : null;

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Consistent page shell: breadcrumb back to the list ─────────── */}
      <Header
        title={opportunity.title}
        subtitle={`${opportunity.categories.join(" · ")} · ${opportunity.severity}`}
        breadcrumbs={[{ label: "Opportunities", href: listHref }, { label: `#${opportunity.id}` }]}
      />

      <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto w-full animate-fade-in-up">
      {/* ── Summary card ───────────────────────────────── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {opportunity.categories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-accent-blue/10 text-blue-400 border border-blue-500/20"
                >
                  {cat}
                </span>
              ))}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${sev.bg} ${sev.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                {opportunity.severity}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-text-primary leading-snug">
              {opportunity.title}
            </h2>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-3xl">
              {opportunity.problem}
            </p>
          </div>

          {/* Overall Score (server-computed, 0–1 → shown as 0–100) */}
          <div className="shrink-0 flex flex-col items-center gap-1 rounded-2xl bg-white/[0.03] border border-white/5 p-4 min-w-[100px]">
            <span className="text-xs text-text-muted font-medium uppercase tracking-wider">
              Score
            </span>
            {scorePct != null ? (
              <>
                <span className={`text-3xl font-bold tabular-nums ${getScoreColor(scorePct)}`}>
                  {scorePct}
                </span>
                <div className="h-1.5 w-16 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${getScoreBarColor(scorePct)}`}
                    style={{ width: `${scorePct}%` }}
                  />
                </div>
              </>
            ) : (
              <span className="text-2xl font-bold text-text-muted">—</span>
            )}
          </div>
        </div>

        {/* ── Date info ───────────────────────────────── */}
        <div className="flex items-center gap-4 text-xs text-text-muted pt-2 border-t border-white/5">
          <span>
            Discovered: {opportunity.createdAt ? formatDate(opportunity.createdAt) : "—"}
          </span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>ID: {opportunity.id}</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span className="capitalize">Status: {opportunity.status.replace(/_/g, " ")}</span>
        </div>
      </div>

      {/* ── Metrics Grid ────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {metrics.map(({ label, value, color, icon: Icon }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-2 rounded-xl bg-white/[0.03] border border-white/5 p-4 hover:bg-white/[0.05] transition-colors"
          >
            <Icon className="h-4 w-4 text-text-muted" />
            <span className={`text-xl font-bold tabular-nums capitalize ${color}`}>
              {value}
            </span>
            <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Two-column layout: Recommendation + Evidence ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recommendation */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-red-400" />
            <h2 className="text-sm font-semibold text-text-primary">Recommendation</h2>
          </div>
          {opportunity.recommendation ? (
            <p className="text-sm text-text-secondary leading-relaxed">
              {opportunity.recommendation}
            </p>
          ) : (
            <p className="text-xs text-text-muted italic">No recommendation provided yet.</p>
          )}
          {opportunity.riskLevel && (
            <div className="mt-4 pt-3 border-t border-white/5">
              <p className="text-xs text-text-muted mb-1">Implementation risk</p>
              <p className={`text-sm font-bold capitalize ${riskColor(opportunity.riskLevel)}`}>
                {opportunity.riskLevel}
              </p>
              {opportunity.riskDescription && (
                <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                  {opportunity.riskDescription}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Evidence */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-text-primary">Evidence</h2>
            <span className="ml-auto text-xs text-text-muted">
              {opportunity.evidence.length} item{opportunity.evidence.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {opportunity.evidence.length > 0 ? (
              opportunity.evidence.map((ev, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-white/[0.02] border border-white/5 p-3"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-blue/10 text-blue-400 border border-blue-500/20">
                      {ev.type}
                    </span>
                    <span className="text-[10px] text-text-muted truncate">{ev.source}</span>
                  </div>
                  <p className="text-xs text-text-secondary">{ev.description}</p>
                  {ev.confidence != null && (
                    <p className="mt-1.5 text-[10px] font-medium text-text-primary">
                      Confidence: <span className="text-accent-cyan">{formatConfidence(ev.confidence)}</span>
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-text-muted italic">No evidence collected yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Expected Impact ──────────────────────────── */}
      {(opportunity.impactSummary || opportunity.impactMetrics.length > 0 || opportunity.affectedServices.length > 0) && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Expected Impact</h2>
          {opportunity.impactSummary && (
            <p className="text-sm text-text-secondary leading-relaxed">{opportunity.impactSummary}</p>
          )}
          {opportunity.impactMetrics.length > 0 && (
            <div className="mt-3 space-y-2">
              {opportunity.impactMetrics.map((m, i) => (
                <div key={i} className="rounded-lg bg-white/[0.02] border border-white/5 p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs font-medium text-text-primary">{m.name}</p>
                    {m.isEstimate && (
                      <span className="text-[10px] text-amber-400">estimate — not a measured value</span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary tabular-nums">
                    {m.currentValue ?? "—"} → {m.expectedValue ?? "—"}
                    {m.changePercent != null && (
                      <span className="ml-2 text-text-muted">({m.changePercent > 0 ? "+" : ""}{m.changePercent}%)</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
          {opportunity.affectedServices.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {opportunity.affectedServices.map((svc) => (
                <span
                  key={svc}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-3 py-1.5 text-xs font-medium text-text-secondary"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" />
                  {svc}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Source Locations ─────────────────────────── */}
      {opportunity.locations.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-text-primary">Source Locations</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {opportunity.locations.map((loc, i) => (
              <span
                key={`${loc.file}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-3 py-1.5 text-xs font-mono text-text-secondary hover:bg-white/8 transition-colors"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" />
                {loc.file}
                {loc.startLine != null && `:${loc.startLine}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Effort Estimate ──────────────────────────── */}
      {opportunity.effort && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-text-primary">Effort Estimate</h2>
          </div>
          <p className="text-sm text-text-secondary">
            Size: <span className={`font-bold ${effortColor(opportunity.effort)}`}>{opportunity.effort.tShirt.toUpperCase()}</span>
            {opportunity.effort.estimatedHours != null && (
              <span className="ml-3">≈ {opportunity.effort.estimatedHours} engineering hours</span>
            )}
            {opportunity.effort.estimatedDays != null && (
              <span className="ml-3">≈ {opportunity.effort.estimatedDays} calendar days</span>
            )}
          </p>
          {opportunity.effort.skillsRequired.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {opportunity.effort.skillsRequired.map((s) => (
                <span key={s} className="rounded-lg bg-white/5 border border-white/5 px-2 py-0.5 text-xs text-text-secondary">{s}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Action Buttons ───────────────────────────── */}
      <OpportunityActions opportunityId={opportunity.id} />
      </div>
    </div>
  );
}
