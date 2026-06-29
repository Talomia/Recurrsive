import clsx from "clsx";

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Security:     { bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/20" },
  Performance:  { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/20" },
  Cost:         { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/20" },
  DevOps:       { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  Architecture: { bg: "bg-cyan-500/10",   text: "text-cyan-400",   border: "border-cyan-500/20" },
  Database:     { bg: "bg-green-500/10",  text: "text-green-400",  border: "border-green-500/20" },
  Reliability:  { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  Frontend:     { bg: "bg-pink-500/10",   text: "text-pink-400",   border: "border-pink-500/20" },
};

const DEFAULT_STYLE = { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" };

interface CategoryBadgeProps {
  category: string;
  size?: "sm" | "md";
}

export default function CategoryBadge({ category, size = "sm" }: CategoryBadgeProps) {
  const style = CATEGORY_STYLES[category] ?? DEFAULT_STYLE;
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border font-medium whitespace-nowrap",
        style.bg,
        style.text,
        style.border,
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      )}
    >
      {category}
    </span>
  );
}

// ── Severity badge ───────────────────────────────────────

const SEVERITY_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  critical: { bg: "bg-red-500/10",    text: "text-red-400",    dot: "bg-red-400" },
  high:     { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
  medium:   { bg: "bg-amber-500/10",  text: "text-amber-400",  dot: "bg-amber-400" },
  low:      { bg: "bg-green-500/10",  text: "text-green-400",  dot: "bg-green-400" },
};

interface SeverityBadgeProps {
  severity: string;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.medium;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
        s.bg,
        s.text
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", s.dot)} />
      {severity}
    </span>
  );
}
