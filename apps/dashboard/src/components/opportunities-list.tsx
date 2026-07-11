import Link from "next/link";
import { ArrowRight } from "lucide-react";
import CategoryBadge, { SeverityBadge } from "@/components/category-badge";
import type { Opportunity } from "@/lib/api";

interface OpportunitiesListProps {
  opportunities: Opportunity[];
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-red-400";
  if (score >= 75) return "text-orange-400";
  if (score >= 60) return "text-amber-400";
  return "text-blue-400";
}

function getScoreBarColor(score: number): string {
  if (score >= 90) return "bg-red-500";
  if (score >= 75) return "bg-orange-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-blue-500";
}

export default function OpportunitiesList({
  opportunities,
}: OpportunitiesListProps) {
  const top = opportunities.slice(0, 5);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-primary">
          Top Opportunities
        </h3>
        <Link
          href="/opportunities"
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
            href={`/opportunities/${opp.id}`}
            className="flex items-start gap-4 rounded-xl bg-white/[0.02] border border-white/5 p-4 hover:bg-white/[0.04] hover:border-white/8 transition-all duration-200 animate-fade-in-up"
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            {/* Score */}
            <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
              <span
                className={`text-lg font-bold tabular-nums ${getScoreColor(opp.score)}`}
              >
                {opp.score}
              </span>
              <div className="h-1 w-8 rounded-full bg-white/5 overflow-hidden" aria-hidden="true">
                <div
                  className={`h-full rounded-full ${getScoreBarColor(opp.score)}`}
                  style={{ width: `${opp.score}%` }}
                />
              </div>
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
                <span className="text-[10px] text-text-muted ml-1">
                  {opp.id}
                </span>
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
