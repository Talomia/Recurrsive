import Header from "@/components/header";
import ScoreGauge from "@/components/score-gauge";
import { getHealthDashboard } from "@/lib/api";
import {
  HeartPulse,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Service status helpers
// ---------------------------------------------------------------------------

const SERVICE_STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  healthy: { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400", border: "border-green-500/20" },
  degraded: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400", border: "border-amber-500/20" },
  down: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400", border: "border-red-500/20" },
};

const SERVICE_STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  healthy: CheckCircle2,
  degraded: AlertTriangle,
  down: XCircle,
};

// ---------------------------------------------------------------------------
// Page component (server component)
// ---------------------------------------------------------------------------

export default async function HealthPage() {
  try {
    const health = await getHealthDashboard();

    return (
      <div className="flex flex-col gap-6 p-6">
        <Header
          title="System Health"
          subtitle="Real-time system health monitoring and service status"
        />

        {/* Health Score + Status Cards */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Large Circular Health Score */}
          <div className="glass-card flex flex-col items-center justify-center px-8 py-6 min-w-[200px]">
            <ScoreGauge value={health.overall_score} size={160} label="Health" />
            <p className="mt-3 text-xs text-text-muted text-center">
              Overall System Health
            </p>
          </div>

          {/* Status Cards Grid */}
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* API Latency */}
            <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              <span className={`text-2xl font-bold tabular-nums ${health.api_latency_ms < 200 ? "text-green-400" : health.api_latency_ms < 500 ? "text-amber-400" : "text-red-400"}`}>
                {health.api_latency_ms}
              </span>
              <span className="text-[11px] text-text-muted font-medium">
                API Latency (ms)
              </span>
            </div>

            {/* Memory Usage */}
            <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
              <HardDrive className="h-5 w-5 text-purple-400" />
              <span className={`text-2xl font-bold tabular-nums ${health.memory_usage_percent < 70 ? "text-green-400" : health.memory_usage_percent < 85 ? "text-amber-400" : "text-red-400"}`}>
                {health.memory_usage_percent}%
              </span>
              <span className="text-[11px] text-text-muted font-medium">
                Memory Usage
              </span>
              <div className="h-1.5 w-full max-w-[80px] rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${health.memory_usage_percent < 70 ? "bg-green-500" : health.memory_usage_percent < 85 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${health.memory_usage_percent}%` }}
                />
              </div>
            </div>

            {/* CPU Usage */}
            <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
              <Cpu className="h-5 w-5 text-cyan-400" />
              <span className={`text-2xl font-bold tabular-nums ${health.cpu_usage_percent < 60 ? "text-green-400" : health.cpu_usage_percent < 80 ? "text-amber-400" : "text-red-400"}`}>
                {health.cpu_usage_percent}%
              </span>
              <span className="text-[11px] text-text-muted font-medium">
                CPU Usage
              </span>
              <div className="h-1.5 w-full max-w-[80px] rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${health.cpu_usage_percent < 60 ? "bg-green-500" : health.cpu_usage_percent < 80 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${health.cpu_usage_percent}%` }}
                />
              </div>
            </div>

            {/* Uptime */}
            <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
              <Clock className="h-5 w-5 text-green-400" />
              <span className="text-2xl font-bold text-green-400 tabular-nums">
                {health.uptime_days}d
              </span>
              <span className="text-[11px] text-text-muted font-medium">
                Uptime
              </span>
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
              const style = SERVICE_STATUS_STYLES[service.status] ?? SERVICE_STATUS_STYLES.healthy!;
              const StatusIcon = SERVICE_STATUS_ICONS[service.status] ?? CheckCircle2;

              return (
                <div
                  key={service.name}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Status indicator */}
                  <StatusIcon className={`h-5 w-5 shrink-0 ${style.text}`} />

                  {/* Service name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{service.name}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      Last checked: {new Date(service.last_check).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase border ${style.bg} ${style.text} ${style.border}`}>
                    {service.status}
                  </span>

                  {/* Latency */}
                  {service.latency_ms !== undefined && (
                    <span className="text-xs text-text-secondary tabular-nums hidden sm:block min-w-[60px] text-right">
                      {service.latency_ms}ms
                    </span>
                  )}

                  {/* Uptime */}
                  {service.uptime_percent !== undefined && (
                    <span className={`text-xs tabular-nums hidden md:block min-w-[60px] text-right ${service.uptime_percent >= 99.9 ? "text-green-400" : service.uptime_percent >= 99 ? "text-amber-400" : "text-red-400"}`}>
                      {service.uptime_percent}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  } catch {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Header
          title="System Health"
          subtitle="Real-time system health monitoring and service status"
        />
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-text-muted">
          Unable to load data. The API may be unavailable.
        </div>
      </div>
    );
  }
}
