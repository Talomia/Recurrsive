import Header from "@/components/header";
import ScoreGauge from "@/components/score-gauge";
import { getPolicies, getComplianceReport } from "@/lib/api";
import type { PolicySet } from "@/lib/api";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  BookOpen,
  Ban,
  AlertTriangle,
  CheckCircle2,
  Eye,
  ChevronDown,
} from "lucide-react";

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

// ---------------------------------------------------------------------------
// Policy Set Card (client component for expand/collapse)
// ---------------------------------------------------------------------------

function PolicySetCard({ policySet }: { policySet: PolicySet }) {
  return (
    <details className="group rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15">
      <summary className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        {/* Icon */}
        <div className={`flex-none flex items-center justify-center w-10 h-10 rounded-xl ${policySet.enabled ? "bg-blue-500/10" : "bg-white/5"}`}>
          {policySet.enabled ? (
            <ShieldCheck className="h-5 w-5 text-blue-400" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-text-muted" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {policySet.name}
            </h3>
            <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-medium border ${
              policySet.enabled
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : "bg-white/5 text-text-muted border-white/10"
            }`}>
              {policySet.enabled ? "Active" : "Disabled"}
            </span>
          </div>
          <p className="text-xs text-text-muted line-clamp-1">
            {policySet.description}
          </p>
        </div>

        {/* Rule count + chevron */}
        <div className="flex items-center gap-3 flex-none">
          <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-xs text-text-secondary font-medium">
            {policySet.rule_count} {policySet.rule_count === 1 ? "rule" : "rules"}
          </span>
          <ChevronDown className="h-4 w-4 text-text-muted transition-transform group-open:rotate-180" />
        </div>
      </summary>

      {/* Rules table */}
      <div className="border-t border-white/5 px-5 py-4 space-y-2 animate-fade-in-up">
        {policySet.rules.length === 0 ? (
          <p className="text-xs text-text-muted py-2">No rules defined in this policy set.</p>
        ) : (
          <div className="rounded-xl border border-white/5 overflow-hidden divide-y divide-white/5">
            {policySet.rules.map((rule) => {
              const cfg = getActionConfig(rule.action);
              const ActionIcon = cfg.icon;
              return (
                <div key={rule.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  {/* Action badge */}
                  <span className={`flex-none flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.color} ${cfg.border} border mt-0.5`}>
                    <ActionIcon className="h-3 w-3" />
                    {rule.action.replace("_", " ")}
                  </span>

                  {/* Rule details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {rule.name}
                    </p>
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
        )}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Page component (server component)
// ---------------------------------------------------------------------------

export default async function PoliciesPage() {
  let policies: PolicySet[] = [];
  let compliance = {
    total_opportunities: 0,
    compliant: 0,
    blocked: 0,
    compliance_rate: 100,
    policy_sets_active: 0,
  };
  let error: string | null = null;

  try {
    [policies, compliance] = await Promise.all([
      getPolicies(),
      getComplianceReport(),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load policies";
  }

  const totalRules = policies.reduce((sum, ps) => sum + ps.rule_count, 0);
  const enabledSets = policies.filter((ps) => ps.enabled).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header
        title="Policies"
        subtitle="Governance rules and compliance status for engineering opportunities"
      />

      {/* Error state */}
      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-5 py-4 flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-red-400 flex-none" />
          <div>
            <p className="text-sm font-medium text-red-400">Failed to load policies</p>
            <p className="text-xs text-text-muted mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Stats bar + Compliance gauge */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Compliance Gauge */}
        <div className="glass-card flex flex-col items-center justify-center px-8 py-6 min-w-[200px]">
          <ScoreGauge value={compliance.compliance_rate} size={140} label="Compliance" />
          <p className="mt-3 text-xs text-text-muted text-center">
            Overall compliance rate
          </p>
        </div>

        {/* Stats cards */}
        <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Policy Sets */}
          <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
            <Shield className="h-5 w-5 text-blue-400" />
            <span className="text-2xl font-bold text-text-primary tabular-nums">
              {enabledSets}
            </span>
            <span className="text-[11px] text-text-muted font-medium">
              Active Policy Sets
            </span>
          </div>

          {/* Total Rules */}
          <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
            <BookOpen className="h-5 w-5 text-purple-400" />
            <span className="text-2xl font-bold text-text-primary tabular-nums">
              {totalRules}
            </span>
            <span className="text-[11px] text-text-muted font-medium">
              Total Rules
            </span>
          </div>

          {/* Compliant */}
          <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <span className="text-2xl font-bold text-green-400 tabular-nums">
              {compliance.compliant}
            </span>
            <span className="text-[11px] text-text-muted font-medium">
              Compliant
            </span>
          </div>

          {/* Blocked */}
          <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
            <Ban className="h-5 w-5 text-red-400" />
            <span className="text-2xl font-bold text-red-400 tabular-nums">
              {compliance.blocked}
            </span>
            <span className="text-[11px] text-text-muted font-medium">
              Blocked
            </span>
          </div>
        </div>
      </div>

      {/* Policy Sets */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-text-primary">Policy Sets</h2>
          <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-text-muted font-medium">
            {policies.length}
          </span>
        </div>

        {policies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-2xl bg-blue-500/10 p-4 mb-4">
              <Shield className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-sm font-medium text-text-primary mb-1">
              No Policies Configured
            </h3>
            <p className="text-xs text-text-muted max-w-xs">
              Policy sets define governance rules for engineering opportunities.
              Run an analysis to see built-in policies in action.
            </p>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {policies.map((ps) => (
              <PolicySetCard key={ps.id} policySet={ps} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
