import Header from "@/components/header";
import { Sparkles, TrendingUp, Eye, Zap, GitBranch, AlertTriangle } from "lucide-react";

const INSIGHTS = [
  {
    icon: TrendingUp,
    color: "text-green-400",
    bg: "bg-green-500/10",
    title: "Code Quality Improving",
    description: "Overall code quality has improved 12% over the last 30 days, primarily driven by reduced cyclomatic complexity in the order-service module.",
    confidence: 94,
    trend: "+12%",
  },
  {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    title: "Growing Technical Debt in Auth Module",
    description: "The authentication module has accumulated 23% more technical debt than the rest of the codebase. Consider prioritizing the OAuth migration opportunity.",
    confidence: 88,
    trend: "+23%",
  },
  {
    icon: Zap,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    title: "Performance Bottleneck Detected",
    description: "Database query latency in the order-processing pipeline is 3.4x higher than the system average. N+1 query patterns are the primary contributor.",
    confidence: 96,
    trend: "3.4x",
  },
  {
    icon: GitBranch,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    title: "Architecture Pattern Suggestion",
    description: "Based on your service communication patterns, introducing an event bus would reduce inter-service coupling by an estimated 40%.",
    confidence: 78,
    trend: "-40%",
  },
  {
    icon: Eye,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    title: "Security Vulnerability Window",
    description: "3 dependencies have known CVEs with available patches. Average time-to-patch is 14 days, above the recommended 7-day window.",
    confidence: 99,
    trend: "14d",
  },
];

export default function InsightsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Insights" subtitle="Evidence-backed intelligence from your engineering knowledge graph" />
      <div className="flex-1 p-6 space-y-6">
        {/* Hero */}
        <div className="glass-card p-6 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-purple to-accent-blue">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              AI-Generated Insights
            </h2>
            <p className="text-sm text-text-secondary">
              {INSIGHTS.length} active insights across your codebase · Updated 2 hours ago
            </p>
          </div>
        </div>

        {/* Insights grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 stagger-children">
          {INSIGHTS.map((insight, i) => {
            const Icon = insight.icon;
            return (
              <div key={i} className="glass-card p-5 hover:scale-[1.01] transition-transform duration-200">
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${insight.bg}`}>
                    <Icon className={`h-5 w-5 ${insight.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-text-primary">{insight.title}</h3>
                      <span className={`text-xs font-bold tabular-nums ${insight.color}`}>{insight.trend}</span>
                    </div>
                    <p className="mt-2 text-sm text-text-secondary leading-relaxed">{insight.description}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-text-muted">Confidence</span>
                        <div className="h-1.5 w-16 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full bg-accent-blue" style={{ width: `${insight.confidence}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold text-text-secondary tabular-nums">{insight.confidence}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
