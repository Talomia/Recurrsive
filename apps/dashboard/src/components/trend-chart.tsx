"use client";

import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";

interface TrendChartProps {
  data: { value: number }[];
  color?: string;
  height?: number;
}

export default function TrendChart({
  data,
  color = "#3b82f6",
  height = 40,
}: TrendChartProps) {
  if (!data || data.length === 0) return null;

  // Strip '#' from hex colors — '#' in SVG IDs breaks url() references
  const safeId = `trend-${color.replace("#", "")}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={safeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis domain={["dataMin - 5", "dataMax + 5"]} hide />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${safeId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
