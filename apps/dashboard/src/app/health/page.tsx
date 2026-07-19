import Header from "@/components/header";
import ScoreGauge from "@/components/score-gauge";
import ErrorBanner from "@/components/error-banner";
import { getHealthDashboard } from "@/lib/api";
import {
  HeartPulse,
  HardDrive,
  MemoryStick,
  Clock,
  CheckCircle2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Service status helpers (real init-derived statuses only)
// ---------------------------------------------------------------------------

const SERVICE_STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  up: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
  idle: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
};

const SERVICE_STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  up: CheckCircle2,
  idle: Clock,
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

// ---------------------------------------------------------------------------
// Page component (server component)
// ---------------------------------------------------------------------------

export default async function HealthPage() {
  try {
    const health = await getHealthDashboard();
    const memPercent = health.memory.usage_percent;

    return (
      <div className="flex flex-col gap-6 p-6">
        <Header
          title="System Health"
          subtitle="Live process metrics and service status"
          primaryAction={{ label: "Run Analysis", href: "/projects" }}
        />

        {/* Health Score + Status Cards */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Large Circular Health Score */}
          <div className="glass-card flex flex-col items-center justify-center px-8 py-6 min-w-[200px]">
            {health.overall_score != null ? (
              <>
                <ScoreGauge value={health.overall_score} size={160} label="Health" />
                <p className="mt-3 text-xs text-text-muted text-center">
                  Overall Project Health
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-center min-h-[160px]">
                <HeartPulse className="h-8 w-8 text-text-muted" />
                <p className="text-sm font-medium text-text-secondary">Not analyzed yet</p>
                <p className="text-xs text-text-muted">Run an analysis to compute a health score.</p>
              </div>
            )}
          </div>

          {/* Real process metrics (no fabricated latency/CPU percentages) */}
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Memory Usage */}
            <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
              <MemoryStick className="h-5 w-5 text-purple-400" />
              <span className={`text-2xl font-bold tabular-nums ${memPercent < 70 ? "text-green-400" : memPercent < 85 ? "text-amber-400" : "text-red-400"}`}>
                {memPercent}%
              </span>
              <span className="text-[11px] text-text-muted font-medium">Memory Usage</span>
              <div className="h-1.5 w-full max-w-[80px] rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${memPercent < 70 ? "bg-green-500" : memPercent < 85 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, memPercent)}%` }}
                />
              </div>
            </div>

            {/* Heap Used */}
            <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
              <HardDrive className="h-5 w-5 text-cyan-400" />
              <span className="text-2xl font-bold text-cyan-400 tabular-nums">
                {formatBytes(health.memory.heap_used_bytes)}
              </span>
              <span className="text-[11px] text-text-muted font-medium">Heap Used</span>
            </div>

            {/* Uptime */}
            <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
              <Clock className="h-5 w-5 text-green-400" />
              <span className="text-2xl font-bold text-green-400 tabular-nums">
                {formatUptime(health.uptime_seconds)}
              </span>
              <span className="text-[11px] text-text-muted font-medium">Process Uptime</span>
            </div>
          </div>
        </div>

        {/* Service Status List */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <HeartPulse className="h-4 w-4 text-red-400" />
            <h2 className="text-sm font-semibold text-text-primary">Service Status</h2>
            <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-text-muted font-medium">
              {health.services.length}
            </span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden divide-y divide-white/5">
            {health.services.map((service) => {
              const style = SERVICE_STATUS_STYLES[service.status] ?? SERVICE_STATUS_STYLES.idle!;
              const StatusIcon = SERVICE_STATUS_ICONS[service.status] ?? Clock;

              return (
                <div
                  key={service.name}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  <StatusIcon className={`h-5 w-5 shrink-0 ${style.text}`} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{service.name}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      Last checked: {new Date(service.last_check).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase border ${style.bg} ${style.text} ${style.border}`}>
                    {service.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  } catch (err) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Header
          title="System Health"
          subtitle="Live process metrics and service status"
        />
        <ErrorBanner
          message={`${err instanceof Error ? err.message : 'Unable to load health data.'} — the analysis server is unreachable or returned an error. This is not the same as having no data yet.`}
        />
      </div>
    );
  }
}
