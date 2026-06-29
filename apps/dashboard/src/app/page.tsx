import {
  Activity,
  Lightbulb,
  DollarSign,
  Brain,
  Clock,
  Globe,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import Header from "@/components/header";
import MetricCard from "@/components/metric-card";
import ScoreGauge from "@/components/score-gauge";
import TrendChart from "@/components/trend-chart";
import HealthChart from "@/components/health-chart";
import OpportunitiesList from "@/components/opportunities-list";
import {
  getHealthMetrics,
  getTimeline,
  getOpportunities,
  getPerformanceMetrics,
} from "@/lib/api";

export default async function OverviewPage() {
  const [health, timeline, opportunities, perfMetrics] = await Promise.all([
    getHealthMetrics(),
    getTimeline(),
    getOpportunities(),
    getPerformanceMetrics(),
  ]);

  const PERF_ICONS = [Clock, Globe, AlertTriangle, CheckCircle];
  const PERF_COLORS = ["#3b82f6", "#22c55e", "#ef4444", "#22d3ee"];

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Intelligence Overview"
        subtitle="Evidence-backed system health, recommendations, and engineering intelligence"
      />

      <div className="flex-1 p-6 space-y-6 stagger-children">
        {/* ── Top Metrics Row ──────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Health Score */}
          <div className="glass-card p-5 flex items-center gap-5">
            <ScoreGauge value={health.healthScore} size={90} label="Health" />
            <div className="flex-1">
              <p className="text-xs font-medium text-text-secondary">
                Health Score
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">
                {health.healthScore}
                <span className="text-sm text-text-muted font-normal">
                  /100
                </span>
              </p>
              <div className="mt-1 flex items-center gap-1">
                <span className={`text-xs font-semibold ${health.healthTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {health.healthTrend >= 0 ? '+' : ''}{health.healthTrend}%
                </span>
                <span className="text-xs text-text-muted">vs last 30d</span>
              </div>
            </div>
          </div>

          {/* Opportunities */}
          <MetricCard
            icon={<Lightbulb className="h-4 w-4 text-amber-400" />}
            label="Opportunities"
            value={health.opportunities}
            trend={12.5}
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
              +{health.newOpportunities} new this week
            </span>
          </MetricCard>

          {/* Tech Debt */}
          <MetricCard
            icon={<DollarSign className="h-4 w-4 text-red-400" />}
            label="Tech Debt Estimate"
            value={`$${(health.techDebt / 1000).toFixed(1)}K`}
            trend={health.techDebtTrend}
          >
            <TrendChart
              data={[
                { value: 165 },
                { value: 160 },
                { value: 158 },
                { value: 155 },
                { value: 152 },
                { value: 148 },
                { value: 145 },
                { value: 143 },
              ]}
              color="#ef4444"
              height={32}
            />
          </MetricCard>

          {/* AI Quality */}
          <MetricCard
            icon={<Brain className="h-4 w-4 text-purple-400" />}
            label="AI Quality Score"
            value={health.aiQualityScore}
            suffix="/100"
            trend={health.aiQualityTrend}
          >
            <TrendChart
              data={[
                { value: 88 },
                { value: 89 },
                { value: 90 },
                { value: 91 },
                { value: 91 },
                { value: 92 },
                { value: 93 },
                { value: 94 },
              ]}
              color="#8b5cf6"
              height={32}
            />
          </MetricCard>
        </div>

        {/* ── Health Chart + Opportunities ─────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3">
            <HealthChart data={timeline} />
          </div>
          <div className="xl:col-span-2">
            <OpportunitiesList opportunities={opportunities} />
          </div>
        </div>

        {/* ── Performance Metrics ──────────────────────── */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Performance Metrics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {perfMetrics.map((metric, i) => {
              const Icon = PERF_ICONS[i] ?? Activity;
              const iconColor = PERF_COLORS[i] ?? "#94a3b8";
              return (
                <MetricCard
                  key={metric.label}
                  icon={<Icon className="h-4 w-4" style={{ color: iconColor }} />}
                  label={metric.label}
                  value={metric.value}
                  suffix={metric.unit}
                  trend={metric.trend}
                >
                  <TrendChart data={metric.data} color={iconColor} height={36} />
                </MetricCard>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
