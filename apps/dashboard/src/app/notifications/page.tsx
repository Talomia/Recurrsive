import Header from "@/components/header";
import { getNotificationChannels, getNotificationHistory } from "@/lib/api";
import type { NotificationChannel, NotificationEntry } from "@/lib/api";
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Send,
  Monitor,
  MessageSquare,
  Globe,
  Inbox,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Severity badge styling
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  warning:  { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  info:     { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  success:  { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
};

function getSeverityColor(severity: string) {
  return SEVERITY_COLORS[severity] ?? { bg: "bg-white/5", text: "text-text-secondary", border: "border-white/10" };
}

// ---------------------------------------------------------------------------
// Channel badge styling
// ---------------------------------------------------------------------------

const CHANNEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  console: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  slack:   { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  http:    { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
};

function getChannelColor(channel: string) {
  return CHANNEL_COLORS[channel] ?? { bg: "bg-white/5", text: "text-text-secondary", border: "border-white/10" };
}

const CHANNEL_ICONS: Record<string, typeof Monitor> = {
  console: Monitor,
  slack: MessageSquare,
  http: Globe,
};

// ---------------------------------------------------------------------------
// Channel Card
// ---------------------------------------------------------------------------

function ChannelCard({ channel }: { channel: NotificationChannel }) {
  const Icon = CHANNEL_ICONS[channel.type] ?? Globe;

  return (
    <div className="group rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15 hover:bg-white/[0.04]">
      <div className="flex flex-col gap-4 p-5">
        {/* Icon + Status */}
        <div className="flex items-center justify-between">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-xl ${
              channel.enabled ? "bg-green-500/10" : "bg-white/5"
            }`}
          >
            <Icon
              className={`h-5 w-5 ${
                channel.enabled ? "text-green-400" : "text-text-muted"
              }`}
            />
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium border ${
              channel.enabled
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : "bg-white/5 text-text-muted border-white/10"
            }`}
          >
            {channel.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        {/* Name + Description */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            {channel.name}
          </h3>
          <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">
            {channel.description}
          </p>
        </div>

        {/* Test button */}
        <button
          className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors w-full"
          title={`Send test notification via ${channel.name}`}
        >
          <Send className="h-3.5 w-3.5" />
          Test
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component (server component)
// ---------------------------------------------------------------------------

export default async function NotificationsPage() {
  let channels: NotificationChannel[] = [];
  let history: NotificationEntry[] = [];
  let error: string | null = null;

  try {
    [channels, history] = await Promise.all([
      getNotificationChannels(),
      getNotificationHistory(),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load notifications";
  }

  const enabledCount = channels.filter((c) => c.enabled).length;
  const deliveredCount = history.filter((n) => n.status === "delivered").length;
  const failedCount = history.filter((n) => n.status === "failed").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header
        title="Notification Center"
        subtitle={`${channels.length} channels configured · ${enabledCount} active`}
      />

      {/* Error state */}
      {error && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-5 py-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-none" />
          <div>
            <p className="text-sm font-medium text-red-400">
              Failed to load notifications
            </p>
            <p className="text-xs text-text-muted mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Channels */}
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <Bell className="h-5 w-5 text-blue-400" />
          <span className="text-2xl font-bold text-text-primary tabular-nums">
            {enabledCount}/{channels.length}
          </span>
          <span className="text-[11px] text-text-muted font-medium">
            Active Channels
          </span>
        </div>

        {/* Delivered */}
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
          <span className="text-2xl font-bold text-green-400 tabular-nums">
            {deliveredCount}
          </span>
          <span className="text-[11px] text-text-muted font-medium">
            Delivered
          </span>
        </div>

        {/* Failed */}
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <XCircle className="h-5 w-5 text-red-400" />
          <span
            className={`text-2xl font-bold tabular-nums ${
              failedCount > 0 ? "text-red-400" : "text-text-primary"
            }`}
          >
            {failedCount}
          </span>
          <span className="text-[11px] text-text-muted font-medium">
            Failed
          </span>
        </div>
      </div>

      {/* Available Channels Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-text-primary">
            Available Channels
          </h2>
          <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-text-muted font-medium">
            {channels.length}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {channels.map((channel) => (
            <ChannelCard key={channel.type} channel={channel} />
          ))}
        </div>
      </div>

      {/* History Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-text-primary">
            Notification History
          </h2>
          <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-text-muted font-medium">
            {history.length}
          </span>
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-2xl bg-blue-500/10 p-4 mb-4">
              <Inbox className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-sm font-medium text-text-primary mb-1">
              No Notifications Yet
            </h3>
            <p className="text-xs text-text-muted max-w-xs">
              Notifications will appear here once events are triggered. Send a test notification to get started.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-[11px] font-medium text-text-muted px-5 py-3">
                    Status
                  </th>
                  <th className="text-left text-[11px] font-medium text-text-muted px-5 py-3">
                    Title
                  </th>
                  <th className="text-left text-[11px] font-medium text-text-muted px-5 py-3 hidden sm:table-cell">
                    Channel
                  </th>
                  <th className="text-left text-[11px] font-medium text-text-muted px-5 py-3 hidden md:table-cell">
                    Severity
                  </th>
                  <th className="text-left text-[11px] font-medium text-text-muted px-5 py-3 hidden lg:table-cell">
                    Sent
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => {
                  const sevColor = getSeverityColor(entry.severity);
                  const chColor = getChannelColor(entry.channel);
                  const sentDate = new Date(entry.sent_at).toLocaleString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  );

                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Status icon */}
                      <td className="px-5 py-3">
                        {entry.status === "delivered" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                      </td>

                      {/* Title */}
                      <td className="px-5 py-3">
                        <p className="text-xs font-medium text-text-primary truncate max-w-xs">
                          {entry.title}
                        </p>
                      </td>

                      {/* Channel badge */}
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${chColor.bg} ${chColor.text} ${chColor.border}`}
                        >
                          {entry.channel}
                        </span>
                      </td>

                      {/* Severity */}
                      <td className="px-5 py-3 hidden md:table-cell">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${sevColor.bg} ${sevColor.text} ${sevColor.border}`}
                        >
                          {entry.severity}
                        </span>
                      </td>

                      {/* Sent timestamp */}
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <span className="text-xs text-text-secondary">
                          {sentDate}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
