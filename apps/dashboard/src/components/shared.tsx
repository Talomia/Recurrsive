'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// ---------------------------------------------------------------------------
// Status Badge — Reusable status indicator with consistent colors
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  active:    { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  enabled:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  complete:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  delivered: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  running:   { bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-400' },
  pending:   { bg: 'bg-yellow-500/10',  text: 'text-yellow-400',  dot: 'bg-yellow-400' },
  partial:   { bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  warning:   { bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  failed:    { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400' },
  error:     { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400' },
  disabled:  { bg: 'bg-white/5',        text: 'text-white/40',    dot: 'bg-white/30' },
  paused:    { bg: 'bg-white/5',        text: 'text-white/40',    dot: 'bg-white/30' },
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status.toLowerCase()] ?? {
    bg: 'bg-white/5', text: 'text-white/60', dot: 'bg-white/40',
  };
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ${config.bg} ${config.text} ${padding} font-medium`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Empty State — Consistent empty state display
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-white/30" />
      </div>
      <h3 className="text-lg font-semibold text-white/70 mb-1">{title}</h3>
      <p className="text-sm text-white/40 max-w-sm text-center">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 rounded-lg bg-accent/20 text-accent text-sm font-medium hover:bg-accent/30 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Section — Expandable content area
// ---------------------------------------------------------------------------

interface CollapsibleProps {
  title: string;
  badge?: string | number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function Collapsible({ title, badge, defaultOpen = false, children }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {badge !== undefined && (
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs text-white/60">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40" />
        )}
      </button>
      {isOpen && (
        <div className="px-5 pb-4 border-t border-white/5">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data Table — Reusable table with glass styling
// ---------------------------------------------------------------------------

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
}

export function DataTable<T>({ columns, data, keyExtractor, emptyMessage }: DataTableProps<T>) {
  if (data.length === 0 && emptyMessage) {
    return (
      <div className="text-center py-8 text-white/40 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            {columns.map(col => (
              <th
                key={col.key}
                className="text-left text-xs font-medium text-white/50 uppercase tracking-wider py-3 px-4"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.map(item => (
            <tr key={keyExtractor(item)} className="hover:bg-white/[0.02] transition-colors">
              {columns.map(col => (
                <td key={col.key} className="py-3 px-4 text-sm text-white/80">
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress Bar — Animated progress indicator
// ---------------------------------------------------------------------------

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: 'accent' | 'green' | 'red' | 'blue' | 'yellow';
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const PROGRESS_COLORS = {
  accent: 'bg-accent',
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  yellow: 'bg-yellow-500',
};

export function ProgressBar({
  value,
  max = 100,
  color = 'accent',
  size = 'sm',
  showLabel = false,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${height} rounded-full bg-white/10 overflow-hidden`}>
        <div
          className={`${height} rounded-full ${PROGRESS_COLORS[color]} transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-white/50 tabular-nums">{Math.round(percentage)}%</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card — Compact stat display for grids
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  change?: { value: number; label: string };
  color?: string;
}

export function StatCard({ label, value, icon: Icon, change, color }: StatCardProps) {
  const isPositive = change && change.value >= 0;

  return (
    <div className="glass-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color ?? 'bg-accent/10'}`}>
          <Icon className={`w-4 h-4 ${color ? 'text-white/60' : 'text-accent'}`} />
        </div>
      </div>
      <div className="text-2xl font-bold text-text-primary tabular-nums">{value}</div>
      {change && (
        <div className={`text-xs ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{change.value}% {change.label}
        </div>
      )}
    </div>
  );
}
