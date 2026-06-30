import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  Bell,
  Info,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Clock,
  Server,
  Link2,
  Eye,
  Trash2,
  Shield,
  Lightbulb,
  ShieldAlert,
} from "lucide-react";
import { getNotification } from "@/lib/api";

// ---------------------------------------------------------------------------
// Type badge styling
// ---------------------------------------------------------------------------

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string; icon: typeof Info }> = {
  info:    { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/20",   icon: Info },
  warning: { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/20",  icon: AlertTriangle },
  error:   { bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/20",    icon: XCircle },
  success: { bg: "bg-green-500/10",  text: "text-green-400",  border: "border-green-500/20",  icon: CheckCircle2 },
};

const RELATED_ITEM_ICONS: Record<string, typeof Shield> = {
  finding: ShieldAlert,
  policy: Shield,
  opportunity: Lightbulb,
};

const RELATED_ITEM_ROUTES: Record<string, string> = {
  finding: "/findings",
  policy: "/policies",
  opportunity: "/opportunities",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface NotificationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function NotificationDetailPage({ params }: NotificationDetailPageProps) {
  const { id } = await params;
  const notification = await getNotification(id);

  if (!notification) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="rounded-2xl bg-white/5 p-6">
          <AlertCircle className="h-10 w-10 text-text-muted" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">
          Notification Not Found
        </h2>
        <p className="text-sm text-text-muted max-w-xs text-center">
          The notification <span className="text-text-secondary font-mono">{id}</span> could
          not be found.
        </p>
        <Link
          href="/notifications"
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-accent-blue/10 border border-accent-blue/30 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-accent-blue/20 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Notifications
        </Link>
      </div>
    );
  }

  const typeStyle = TYPE_STYLES[notification.type] ?? TYPE_STYLES.info!;
  const TypeIcon = typeStyle.icon;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto animate-fade-in-up">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted">
        <Link
          href="/notifications"
          className="inline-flex items-center gap-1.5 hover:text-text-secondary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Notifications
        </Link>
        <span>/</span>
        <span className="text-text-secondary font-mono text-xs">{notification.id}</span>
      </nav>

      {/* Header */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Bell className="h-5 w-5 text-blue-400" />
              <h1 className="text-2xl font-bold text-text-primary leading-snug">
                {notification.title}
              </h1>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
            <TypeIcon className="h-3.5 w-3.5" />
            {notification.type}
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <Clock className="h-5 w-5 text-amber-400" />
          <span className="text-xs font-bold text-text-primary tabular-nums">
            {new Date(notification.timestamp).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="text-[11px] text-text-muted font-medium">Timestamp</span>
        </div>
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <Server className="h-5 w-5 text-purple-400" />
          <span className="text-lg font-bold text-text-primary">{notification.source}</span>
          <span className="text-[11px] text-text-muted font-medium">Source</span>
        </div>
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <AlertTriangle className="h-5 w-5 text-blue-400" />
          <span className={`text-lg font-bold capitalize ${typeStyle.text}`}>{notification.severity}</span>
          <span className="text-[11px] text-text-muted font-medium">Severity</span>
        </div>
      </div>

      {/* Content Section */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Info className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-text-primary">Full Message</h2>
          {!notification.read && (
            <span className="ml-2 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-500/20">
              Unread
            </span>
          )}
        </div>
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            {notification.message}
          </p>
        </div>
      </div>

      {/* Related Items */}
      {notification.related_items.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="h-4 w-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-text-primary">Related Items</h2>
            <span className="ml-auto text-xs text-text-muted">
              {notification.related_items.length} item{notification.related_items.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {notification.related_items.map((item) => {
              const ItemIcon = RELATED_ITEM_ICONS[item.type] ?? Lightbulb;
              const route = RELATED_ITEM_ROUTES[item.type] ?? "/";

              return (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={`${route}/${encodeURIComponent(item.id)}`}
                  className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/5 p-3 hover:bg-white/[0.04] hover:border-white/10 transition-colors group"
                >
                  <ItemIcon className="h-4 w-4 text-text-muted group-hover:text-accent-blue shrink-0 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent-blue transition-colors">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-text-muted capitalize">{item.type}</span>
                      <span className="text-[10px] text-text-muted font-mono">{item.id}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] border border-white/5 p-5">
        <div className="text-sm text-text-muted">
          Manage this notification
        </div>
        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Dismiss
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
          >
            <Eye className="h-4 w-4" />
            Mark as Read
          </button>
        </div>
      </div>
    </div>
  );
}
