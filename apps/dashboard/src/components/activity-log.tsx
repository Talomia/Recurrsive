'use client';

import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Inline relative time utility (avoids date-fns dependency)
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  try {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActivityType = 'success' | 'error' | 'warning' | 'info' | 'analysis';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, string | number>;
}

// ---------------------------------------------------------------------------
// Activity Icon Map
// ---------------------------------------------------------------------------

const ACTIVITY_ICONS: Record<ActivityType, typeof Activity> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  analysis: Zap,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  success: 'text-emerald-400 bg-emerald-500/10',
  error: 'text-red-400 bg-red-500/10',
  warning: 'text-amber-400 bg-amber-500/10',
  info: 'text-blue-400 bg-blue-500/10',
  analysis: 'text-accent bg-accent/10',
};

// ---------------------------------------------------------------------------
// Activity Log Component
// ---------------------------------------------------------------------------

interface ActivityLogProps {
  items: ActivityItem[];
  maxItems?: number;
  title?: string;
}

export default function ActivityLog({
  items,
  maxItems = 10,
  title = 'Recent Activity',
}: ActivityLogProps) {
  const displayed = items.slice(0, maxItems);

  return (
    <div className="glass-card">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <span className="text-xs text-white/40">{items.length} events</span>
      </div>
      <div className="divide-y divide-white/5">
        {displayed.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-white/40">
            No activity recorded yet
          </div>
        )}
        {displayed.map((item, index) => {
          const Icon = ACTIVITY_ICONS[item.type];
          const colorClass = ACTIVITY_COLORS[item.type];
          const relativeTime = timeAgo(item.timestamp);

          return (
            <div
              key={item.id}
              className="px-5 py-3 flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-text-primary truncate">
                    {item.title}
                  </span>
                  <span className="text-xs text-white/40 whitespace-nowrap">
                    {relativeTime}
                  </span>
                </div>
                {item.description && (
                  <p className="text-xs text-white/50 mt-0.5 truncate">
                    {item.description}
                  </p>
                )}
                {item.metadata && Object.keys(item.metadata).length > 0 && (
                  <div className="flex gap-3 mt-1">
                    {Object.entries(item.metadata).map(([key, val]) => (
                      <span key={key} className="text-xs text-white/30">
                        {key}: <span className="text-white/50">{val}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
