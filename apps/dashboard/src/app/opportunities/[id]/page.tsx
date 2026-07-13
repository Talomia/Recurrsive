import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  Zap,
  AlertCircle,
  CheckCircle2,
  FileText,
  Target,
  Layers,
  ArrowRight,
} from "lucide-react";
import { getOpportunity } from "@/lib/api";

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function getSeverityStyle(severity: string) {
  const styles: Record<string, { bg: string; text: string; dot: string }> = {
    critical: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
    high: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
    medium: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
    low: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400" },
  };
  return styles[severity] ?? styles.medium!;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface OpportunityDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OpportunityDetailPage({ params }: OpportunityDetailPageProps) {
  const { id } = await params;
  const opportunity = await getOpportunity(id);

  if (!opportunity) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
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
          href="/opportunities"
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-accent-blue/10 border border-accent-blue/30 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-accent-blue/20 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Opportunities
        </Link>
      </div>
    );
  }

  const facts = [
    { label: "Confidence", value: `${opportunity.confidence}%`, icon: Shield },
    {
      label: "Effort",
      value: opportunity.estimatedHours !== null
        ? `${opportunity.estimatedHours}h`
        : opportunity.effort === 'unknown' ? 'Not estimated' : opportunity.effort.toUpperCase(),
      icon: Zap,
    },
    { label: "Implementation risk", value: opportunity.risk === 'unknown' ? 'Not assessed' : opportunity.risk, icon: AlertCircle },
    { label: "Evidence", value: String(opportunity.evidence.length), icon: FileText },
    { label: "Status", value: opportunity.status.replaceAll('_', ' '), icon: CheckCircle2 },
  ];

  const sev = getSeverityStyle(opportunity.severity);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto animate-fade-in-up">
      {/* ── Breadcrumb ─────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-sm text-text-muted">
        <Link
          href="/opportunities"
          className="inline-flex items-center gap-1.5 hover:text-text-secondary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Opportunities
        </Link>
        <span>/</span>
        <span className="text-text-secondary font-mono text-xs">{opportunity.id}</span>
      </nav>

      {/* ── Header ─────────────────────────────────────── */}
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
            <h1 className="text-2xl font-bold text-text-primary leading-snug">
              {opportunity.title}
            </h1>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-3xl">
              {opportunity.description}
            </p>
          </div>

          {/* Recorded confidence */}
          <div className="shrink-0 flex flex-col items-center gap-1 rounded-2xl bg-white/[0.03] border border-white/5 p-4 min-w-[120px]">
            <span className="text-xs text-text-muted font-medium uppercase tracking-wider">
              Confidence
            </span>
            <span className="text-3xl font-bold tabular-nums text-blue-400">
              {opportunity.confidence}%
            </span>
            <div className="h-1.5 w-16 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${opportunity.confidence}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Date info ───────────────────────────────── */}
        <div className="flex items-center gap-4 text-xs text-text-muted pt-2 border-t border-white/5">
          <span>
            Discovered: {new Date(opportunity.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>ID: {opportunity.id}</span>
        </div>
      </div>

      {/* ── Recorded facts ───────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {facts.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-2 rounded-xl bg-white/[0.03] border border-white/5 p-4 hover:bg-white/[0.05] transition-colors"
          >
            <Icon className="h-4 w-4 text-text-muted" />
            <span className="text-sm font-bold text-text-primary capitalize text-center">
              {value}
            </span>
            <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Two-column layout: assumptions + evidence ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assumptions */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-red-400" />
            <h2 className="text-sm font-semibold text-text-primary">Assumptions</h2>
          </div>
          <div className="space-y-2">
            {opportunity.assumptions.length > 0 ? (
              opportunity.assumptions.map((assumption, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg bg-white/[0.02] border border-white/5 p-3"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-[10px] font-bold text-red-400">
                    {i + 1}
                  </span>
                  <p className="text-sm text-text-secondary">{assumption}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-text-muted italic">No assumptions were recorded.</p>
            )}
          </div>
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
                  {ev.value && (
                    <p className="mt-1.5 text-[10px] font-medium text-text-primary">
                      Value: <span className="text-accent-cyan">{ev.value}</span>
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

      {/* ── Affected Components ──────────────────────── */}
      {opportunity.affectedComponents.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-text-primary">Affected Components</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {opportunity.affectedComponents.map((comp) => (
              <span
                key={comp}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-white/8 transition-colors"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" />
                {comp}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Implementation Plan ──────────────────────── */}
      {opportunity.solution.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">
            Recommended Solution
          </h2>
          <div className="space-y-3">
            {opportunity.solution.map((step) => (
              <div
                key={step.step}
                className="flex gap-4 rounded-xl bg-white/[0.02] border border-white/5 p-4 hover:bg-white/[0.04] transition-colors"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-blue/10 text-sm font-bold text-blue-400">
                  {step.step}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-text-primary">{step.title}</p>
                    <span className="text-xs text-text-muted whitespace-nowrap">{step.effort}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                    {step.description}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-text-muted shrink-0 mt-1" />
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
