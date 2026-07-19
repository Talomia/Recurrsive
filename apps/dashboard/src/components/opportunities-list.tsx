import Link from "next/link";
import { ArrowRight } from "lucide-react";
import CategoryBadge, { SeverityBadge } from "@/components/category-badge";
import { scopedHref } from "@/lib/project-links";
import type { Opportunity } from "@/lib/api";

interface OpportunitiesListProps {
  opportunities: Opportunity[];
  /** Active project id — keeps the list/detail links project-scoped. */
  projectId?: string | null;
}

/** Confidence is 0–1 from the server; render as a percentage or "—". */
function formatConfidence(confidence: number | null): string {
  return confidence == null ? "—" : `${Math.round(confidence * 100)}%`;
}

function getConfidenceColor(confidence: number | null): string {
  if (confidence == null) return "text-text-muted";
  if (confidence >= 0.8) return "text-green-400";
  if (confidence >= 0.6) return "text-blue-400";
  if (confidence >= 0.4) return "text-amber-400";
  return "text-red-400";
}

export default function OpportunitiesList({
  opportunities,
  projectId,
}: OpportunitiesListProps) {
  const top = opportunities.slice(0, 5);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">
          Top Opportunities
        </h3>
        <Link
          href={scopedHref("/opportunities", projectId)}
          className="flex items-center gap-1 text-xs font-medium text-accent-blue hover:text-blue-300 transition-colors"
        >
          Explore All Opportunities
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      {top.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-text-muted">No opportunities found yet.</p>
          <p className="text-xs text-text-muted mt-1">Run an analysis to discover improvement opportunities.</p>
        </div>
      )}

      {top.length > 0 && (
      <ul className="space-y-3" aria-label="Top opportunities">
        {top.map((opp, i) => (
          <li key={opp.id}>
          <Link
            href={scopedHref(`/opportunities/${encodeURIComponent(opp.id)}`, projectId)}
            className="flex items-start gap-4 rounded-xl bg-white/[0.02] border border-white/5 p-4 hover:bg-white/[0.04] hover:border-white/8 transition-all duration-200 animate-fade-in-up"
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            {/* Confidence — a real 0–1 value from the analysis */}
            <div className="shrink-0 flex flex-col items-center gap-0.5 pt-0.5 min-w-[48px]">
              <span
                className={`text-lg font-bold tabular-nums ${getConfidenceColor(opp.confidence)}`}
              >
                {formatConfidence(opp.confidence)}
              </span>
              <span className="text-[9px] text-text-muted uppercase tracking-wider">
                confidence
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-text-primary leading-snug line-clamp-1">
                  {opp.title}
                </p>
                <SeverityBadge severity={opp.severity} />
              </div>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {opp.categories.map((cat) => (
                  <CategoryBadge key={cat} category={cat} />
                ))}
                {opp.effort && (
                  <span className="text-[10px] text-text-muted ml-1">
                    Effort: {opp.effort.tShirt.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </Link>
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}
