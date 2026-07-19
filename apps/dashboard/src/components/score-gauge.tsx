"use client";

import { useMemo, useId } from "react";

interface ScoreGaugeProps {
  /**
   * Score 0–100, or null when the subject has not been analyzed yet.
   * Null renders an honest "not analyzed" placeholder instead of a
   * fabricated red 0.
   */
  value: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showLabel?: boolean;
}

function getScoreColor(value: number): string {
  if (value >= 90) return "#22c55e";
  if (value >= 75) return "#3b82f6";
  if (value >= 60) return "#f59e0b";
  if (value >= 40) return "#f97316";
  return "#ef4444";
}

function getScoreGradientSuffix(value: number): string {
  if (value >= 90) return "green";
  if (value >= 75) return "blue";
  if (value >= 60) return "amber";
  return "red";
}

export default function ScoreGauge({
  value,
  size = 120,
  strokeWidth = 8,
  label,
  showLabel = true,
}: ScoreGaugeProps) {
  const instanceId = useId();
  const hasValue = typeof value === "number" && !Number.isNaN(value);
  const clamped = hasValue ? Math.max(0, Math.min(100, value)) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useMemo(
    () => circumference - (clamped / 100) * circumference,
    [clamped, circumference]
  );
  const color = getScoreColor(clamped);
  const gradientSuffix = getScoreGradientSuffix(clamped);
  const gId = (name: string) => `${instanceId}-${name}`;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="img"
      aria-label={
        hasValue
          ? `${label ?? "Score"}: ${clamped} out of 100`
          : `${label ?? "Score"}: not analyzed`
      }
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={gId("green")} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
          <linearGradient id={gId("blue")} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id={gId("amber")} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id={gId("red")} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <filter id={gId("glow")}>
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc — only drawn when there is a real score */}
        {hasValue && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gId(gradientSuffix)})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            filter={`url(#${gId("glow")})`}
            style={{
              transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {hasValue ? (
          <span
            className="font-bold tabular-nums"
            style={{
              fontSize: size * 0.28,
              color,
            }}
          >
            {clamped}
          </span>
        ) : (
          <>
            <span
              className="font-bold text-text-muted"
              style={{ fontSize: size * 0.28 }}
            >
              —
            </span>
            <span
              className="text-text-muted"
              style={{ fontSize: Math.max(size * 0.09, 9) }}
            >
              Not analyzed
            </span>
          </>
        )}
        {hasValue && showLabel && label && (
          <span
            className="text-text-muted mt-0.5"
            style={{ fontSize: Math.max(size * 0.1, 10) }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
