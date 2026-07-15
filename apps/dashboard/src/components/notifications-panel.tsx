"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  AlertTriangle,
  Info,
  Zap,
  ShieldAlert,
  Loader2,
  Inbox,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api/client";

// ── Types ──────────────────────────────────────────────────

interface Notification {
  id: string;
  title: string;
  body?: string;
  level: "info" | "warning" | "error" | "success";
  read: boolean;
  createdAt: string;
}

/** Raw notification record as returned by the server history endpoint. */
interface RawNotification {
  id: string;
  title?: string;
  message?: string;
  body?: string;
  level?: string;
  severity?: string;
  status?: string;
  channel?: string;
  read?: boolean;
  createdAt?: string;
  sent_at?: string;
}

const LEVELS = new Set(["info", "warning", "error", "success"]);

/** Map a server record onto the panel's Notification shape. */
function mapNotification(r: RawNotification): Notification {
  let level: Notification["level"] = "info";
  if (r.level && LEVELS.has(r.level)) level = r.level as Notification["level"];
  else if (r.severity === "critical" || r.severity === "high") level = "error";
  else if (r.severity === "medium") level = "warning";
  else if (r.status === "failed") level = "error";
  else if (r.status === "sent") level = "success";

  return {
    id: r.id,
    title: r.title ?? r.message ?? "Notification",
    body: r.body,
    level,
    read: r.read ?? false,
    createdAt: r.createdAt ?? r.sent_at ?? new Date().toISOString(),
  };
}

interface NotificationsPanelProps {
  /** If provided, the panel renders as a controlled component. */
  open?: boolean;
  onClose?: () => void;
}

// ── Icon mapping ─────────────────────────────────────────

const LEVEL_ICONS: Record<string, { icon: typeof Info; color: string }> = {
  info: { icon: Info, color: "text-blue-400" },
  warning: { icon: AlertTriangle, color: "text-amber-400" },
  error: { icon: ShieldAlert, color: "text-red-400" },
  success: { icon: Zap, color: "text-green-400" },
};

// ── Relative time helper ─────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Component ────────────────────────────────────────────

export default function NotificationsPanel({
  open: controlledOpen,
  onClose,
}: NotificationsPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    if (onClose) onClose();
    else setInternalOpen(false);
  }, [onClose]);

  const toggle = useCallback(() => {
    if (controlledOpen !== undefined) {
      // controlled: defer to parent
      if (isOpen && onClose) onClose();
    } else {
      setInternalOpen((prev) => !prev);
    }
  }, [controlledOpen, isOpen, onClose]);

  // Load notifications from the server (used on open and after mark-all-read).
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<RawNotification[]>("/api/v1/notifications/history?limit=10");
      setNotifications(Array.isArray(data) ? data.map(mapNotification) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch notifications when panel opens
  useEffect(() => {
    if (!isOpen) return;
    void load();
  }, [isOpen, load]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, close]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, close]);

  // Mark all as read — only clears the badge once the server confirms.
  const markAllRead = useCallback(async () => {
    try {
      await apiFetch("/api/v1/notifications/read-all", { method: "POST", unwrap: false });
      // Server accepted: reflect the read state locally so the badge clears.
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark all as read");
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      {/* Trigger button (bell) */}
      <button
        ref={triggerRef}
        onClick={toggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
        aria-label="View notifications"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="h-4 w-4 text-text-secondary" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-blue px-1 text-[9px] font-bold text-white"
            aria-label={`${unreadCount} unread notifications`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        {unreadCount === 0 && isOpen === false && (
          <span
            className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent-blue animate-pulse-dot"
            aria-hidden="true"
          />
        )}
      </button>

      {/* Panel dropdown */}
      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] overflow-hidden rounded-2xl z-50"
          style={{
            background: "rgba(15, 15, 25, 0.95)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            boxShadow:
              "0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(59, 130, 246, 0.06)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-text-secondary" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-text-primary">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-blue/15 px-1.5 text-[10px] font-semibold text-blue-400">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                  aria-label="Mark all notifications as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Mark all read
                </button>
              )}
              <button
                onClick={close}
                className="flex items-center justify-center h-6 w-6 rounded-md hover:bg-white/5 transition-colors"
                aria-label="Close notifications"
              >
                <X className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto max-h-[360px]">
            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2
                  className="h-5 w-5 text-text-muted animate-spin"
                  aria-hidden="true"
                />
                <span className="sr-only">Loading notifications</span>
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <div className="flex flex-col items-center justify-center py-10 px-4">
                <AlertTriangle className="h-8 w-8 text-amber-400/60 mb-2" aria-hidden="true" />
                <p className="text-sm text-text-muted text-center">{error}</p>
                <button
                  onClick={() => void load()}
                  className="mt-2 text-xs text-accent-blue hover:underline"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <Inbox className="h-10 w-10 text-text-tertiary mb-3" aria-hidden="true" />
                <p className="text-sm font-medium text-text-secondary">
                  All caught up!
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  No new notifications
                </p>
              </div>
            )}

            {/* Notification list */}
            {!loading &&
              !error &&
              notifications.map((notif) => {
                const levelConfig = LEVEL_ICONS[notif.level] ?? LEVEL_ICONS.info;
                const Icon = levelConfig.icon;

                return (
                  <button
                    key={notif.id}
                    onClick={() => {
                      setNotifications((prev) =>
                        prev.map((n) =>
                          n.id === notif.id ? { ...n, read: true } : n
                        )
                      );
                    }}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 ${
                      !notif.read ? "bg-white/[0.02]" : ""
                    }`}
                    aria-label={`${notif.read ? "" : "Unread: "}${notif.title}`}
                  >
                    {/* Icon */}
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 ${levelConfig.color}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-snug truncate ${
                          notif.read
                            ? "text-text-secondary"
                            : "text-text-primary font-medium"
                        }`}
                      >
                        {notif.title}
                      </p>
                      {notif.body && (
                        <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                          {notif.body}
                        </p>
                      )}
                      <p className="text-[10px] text-text-tertiary mt-1">
                        {timeAgo(notif.createdAt)}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!notif.read && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent-blue" aria-hidden="true" />
                    )}
                    {notif.read && (
                      <Check className="mt-1.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 px-4 py-2.5">
            <a
              href="/notifications"
              className="block w-full text-center text-xs font-medium text-accent-blue hover:text-blue-300 transition-colors"
            >
              View all notifications →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
