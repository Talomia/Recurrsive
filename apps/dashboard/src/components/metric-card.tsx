import { type ReactNode } from "react";
import clsx from "clsx";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  suffix?: string;
  trend?: number;
  trendLabel?: string;
  children?: ReactNode;
  className?: string;
}

export default function MetricCard({
  icon,
  label,
  value,
  suffix,
  trend,
  trendLabel = "vs last 30 days",
  children,
  className,
}: MetricCardProps) {
  const isPositive = trend !== undefined && trend > 0;
  const isNeutral = trend !== undefined && trend === 0;
  const trendColor = trend === undefined || isNeutral
    ? "text-text-muted"
    : isPositive
      ? "text-green-400"
      : "text-red-400";

  return (
    <div
      className={clsx(
        "glass-card p-5 flex flex-col justify-between min-h-[160px]",
        className
      )}
    >
      {/* Top row: icon + label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
            {icon}
          </div>
          <span className="text-xs font-medium text-text-secondary">{label}</span>
        </div>
      </div>

      {/* Value */}
      <div className="mt-3 flex items-end gap-2">
        <span className="text-3xl font-bold tabular-nums tracking-tight text-text-primary">
          {value}
        </span>
        {suffix && (
          <span className="mb-1 text-sm font-medium text-text-muted">{suffix}</span>
        )}
      </div>

      {/* Sparkline or children */}
      {children && <div className="mt-2">{children}</div>}

      {/* Trend */}
      {trend !== undefined && (
        <div className="mt-2 flex items-center gap-1.5">
          {isPositive ? (
            <ArrowUpRight className={clsx("h-3.5 w-3.5", trendColor)} />
          ) : (
            <ArrowDownRight className={clsx("h-3.5 w-3.5", trendColor)} />
          )}
          <span className={clsx("text-xs font-semibold tabular-nums", trendColor)}>
            {Math.abs(trend)}%
          </span>
          <span className="text-xs text-text-muted">{trendLabel}</span>
        </div>
      )}
    </div>
  );
}
