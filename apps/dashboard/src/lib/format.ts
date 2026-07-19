/**
 * @module Formatting helpers
 *
 * Shared, locale-stable date/number formatting so every surface renders values
 * identically (no more bare `toLocaleDateString()` drift across pages).
 */

/** Format an ISO timestamp as a short date, e.g. "Jul 16, 2026". */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** Format an ISO timestamp as date + time, e.g. "Jul 16, 2026, 2:30 PM". */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format a byte count as a human-readable size, e.g. "1.4 MB". */
export function formatBytes(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value) || value < 0) return "—";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = value;
  let unit = "B";
  for (const u of units) {
    if (v < 1024) break;
    v = v / 1024;
    unit = u;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${unit}`;
}

/** Format a relative time from now, e.g. "3 hours ago", falling back to a date. */
export function formatRelative(value: string | number | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.round(hr / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(value);
}
