"use client";

import { useMemo } from "react";

interface ScoreGaugeProps {
  value: number;
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

function getScoreGradientId(value: number): string {
  if (value >= 90) return "gauge-green";
  if (value >= 75) return "gauge-blue";
  if (value >= 60) return "gauge-amber";
  return "gauge-red";
}

export default function ScoreGauge({
  value,
  size = 120,
  strokeWidth = 8,
  label,
  showLabel = true,
}: ScoreGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useMemo(
    () => circumference - (value / 100) * circumference,
    [value, circumference]
  );
  const color = getScoreColor(value);
  const gradientId = getScoreGradientId(value);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="gauge-green" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
          <linearGradient id="gauge-blue" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="gauge-amber" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="gauge-red" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <filter id="gauge-glow">
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
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          filter="url(#gauge-glow)"
          style={{
            transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-bold tabular-nums"
          style={{
            fontSize: size * 0.28,
            color,
          }}
        >
          {value}
        </span>
        {showLabel && label && (
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
