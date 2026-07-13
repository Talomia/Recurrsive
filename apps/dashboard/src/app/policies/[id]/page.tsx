import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  BookOpen,
  Settings,
  Ban,
  Eye,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { getPolicy } from "@/lib/api";

// ---------------------------------------------------------------------------
// Action badge styling
// ---------------------------------------------------------------------------

const ACTION_CONFIG: Record<string, { color: string; bg: string; border: string; icon: typeof Ban }> = {
  block:            { color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20",    icon: Ban },
  require_approval: { color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20",  icon: Eye },
  warn:             { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", icon: AlertTriangle },
  allow:            { color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20",  icon: CheckCircle2 },
};

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] ?? ACTION_CONFIG.allow!;
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  high: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  low: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
};

const VIOLATION_STATUS: Record<string, { bg: string; text: string; border: string }> = {
  active: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  resolved: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
  waived: { bg: "bg-white/5", text: "text-text-muted", border: "border-white/10" },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PolicyDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ projectId?: string }>;
}

export default async function PolicyDetailPage({ params, searchParams }: PolicyDetailPageProps) {
  const { id } = await params;
  const { projectId } = await searchParams;
  if (!projectId) return null;
  const policy = await getPolicy(id, projectId);

  if (!policy) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="rounded-2xl bg-white/5 p-6">
          <AlertCircle className="h-10 w-10 text-text-muted" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">
          Policy Not Found
        </h2>
        <p className="text-sm text-text-muted max-w-xs text-center">
          The policy <span className="text-text-secondary font-mono">{id}</span> could
          not be found.
        </p>
        <Link
          href={`/policies?projectId=${encodeURIComponent(projectId)}`}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-accent-blue/10 border border-accent-blue/30 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-accent-blue/20 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Policies
        </Link>
      </div>
    );
  }

  const sevStyle = SEVERITY_STYLES[policy.severity] ?? SEVERITY_STYLES.medium!;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted">
        <Link
          href={`/policies?projectId=${encodeURIComponent(projectId)}`}
          className="inline-flex items-center gap-1.5 hover:text-text-secondary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Policies
        </Link>
        <span>/</span>
        <span className="text-text-secondary font-mono text-xs">{policy.id}</span>
      </nav>

      {/* Header */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {policy.enabled ? (
                <ShieldCheck className="h-5 w-5 text-green-400" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-text-muted" />
              )}
              <h1 className="text-2xl font-bold text-text-primary leading-snug">
                {policy.name}
              </h1>
            </div>
            <p className="mt-1 text-sm text-text-secondary leading-relaxed max-w-3xl">
              {policy.description}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
            policy.enabled
              ? "bg-green-500/10 text-green-400 border-green-500/20"
              : "bg-white/5 text-text-muted border-white/10"
          }`}>
            <span className={`h-2 w-2 rounded-full ${policy.enabled ? "bg-green-400" : "bg-gray-400"}`} />
            {policy.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <span className={`text-lg font-bold capitalize ${sevStyle.text}`}>
            {policy.severity}
          </span>
          <span className="text-[11px] text-text-muted font-medium">Severity</span>
        </div>
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <Shield className="h-5 w-5 text-blue-400" />
          <span className="text-lg font-bold text-text-primary">{policy.category}</span>
          <span className="text-[11px] text-text-muted font-medium">Category</span>
        </div>
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <BookOpen className="h-5 w-5 text-purple-400" />
          <span className="text-lg font-bold text-text-primary">{policy.scope}</span>
          <span className="text-[11px] text-text-muted font-medium">Scope</span>
        </div>
      </div>

      {/* Rules Section */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-text-primary">Rules</h2>
          <span className="ml-auto text-xs text-text-muted">
            {policy.rules.length} rule{policy.rules.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
          {policy.rules.map((rule) => {
            const cfg = getActionConfig(rule.action);
            const ActionIcon = cfg.icon;
            return (
              <div key={rule.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                <span className={`flex-none flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.color} ${cfg.border} border mt-0.5`}>
                  <ActionIcon className="h-3 w-3" />
                  {rule.action.replace("_", " ")}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{rule.name}</p>
                  {rule.description && (
                    <p className="text-xs text-text-muted mt-0.5">{rule.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] text-text-muted">
                      Scope: <span className="text-text-secondary font-medium">{rule.scope}</span>
                    </span>
                    <span className="text-[10px] text-text-muted font-mono truncate">
                      {rule.condition}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-text-primary">Configuration</h2>
        </div>
        <pre className="rounded-xl bg-white/[0.02] border border-white/5 p-4 text-xs text-text-secondary font-mono overflow-x-auto leading-relaxed">
          {JSON.stringify(policy.config, null, 2)}
        </pre>
      </div>

      {/* Violations List */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <h2 className="text-sm font-semibold text-text-primary">Recent Violations</h2>
          <span className="ml-auto text-xs text-text-muted">
            {policy.violations.length} violation{policy.violations.length !== 1 ? "s" : ""}
          </span>
        </div>
        {policy.violations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-6 w-6 text-green-400 mb-2" />
            <p className="text-xs text-text-muted">No violations found. All clear!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {policy.violations.map((violation) => {
              const vs = VIOLATION_STATUS[violation.status] ?? VIOLATION_STATUS.active!;
              return (
                <div
                  key={violation.id}
                  className="flex items-start gap-3 rounded-xl bg-white/[0.02] border border-white/5 p-4 hover:bg-white/[0.04] transition-colors"
                >
                  <AlertCircle className={`h-4 w-4 shrink-0 mt-0.5 ${vs.text}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {violation.opportunity_title}
                    </p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[10px] text-text-muted">
                        Rule: <span className="text-text-secondary font-medium">{violation.rule_name}</span>
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">
                        {violation.opportunity_id}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {new Date(violation.detected_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${vs.bg} ${vs.text} ${vs.border}`}>
                    {violation.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Metadata Footer */}
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span>Created: {new Date(policy.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
        <span className="h-1 w-1 rounded-full bg-white/20" />
        <span>Updated: {new Date(policy.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
        <span className="h-1 w-1 rounded-full bg-white/20" />
        <span className="font-mono">{policy.id}</span>
      </div>
    </div>
  );
}
