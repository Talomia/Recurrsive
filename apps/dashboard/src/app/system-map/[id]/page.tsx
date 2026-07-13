import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  Box,
  Hash,
  GitBranch,
} from "lucide-react";
import { getEntityWithRelationships } from "@/lib/api";
import ProjectScopeRequired from "@/components/project-scope-required";

// ---------------------------------------------------------------------------
// Type styling (matches search page)
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  function: { color: "text-blue-400", bg: "bg-blue-500/10", icon: "ƒ" },
  class: { color: "text-purple-400", bg: "bg-purple-500/10", icon: "C" },
  module: { color: "text-cyan-400", bg: "bg-cyan-500/10", icon: "M" },
  file: { color: "text-green-400", bg: "bg-green-500/10", icon: "F" },
  endpoint: { color: "text-amber-400", bg: "bg-amber-500/10", icon: "E" },
  repository: { color: "text-red-400", bg: "bg-red-500/10", icon: "R" },
  prompt: { color: "text-pink-400", bg: "bg-pink-500/10", icon: "P" },
  agent: { color: "text-violet-400", bg: "bg-violet-500/10", icon: "A" },
  model: { color: "text-orange-400", bg: "bg-orange-500/10", icon: "⬡" },
  table: { color: "text-teal-400", bg: "bg-teal-500/10", icon: "T" },
  query: { color: "text-indigo-400", bg: "bg-indigo-500/10", icon: "Q" },
  default: { color: "text-gray-400", bg: "bg-gray-500/10", icon: "•" },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.default!;
}

// ---------------------------------------------------------------------------
// Relationship type styling
// ---------------------------------------------------------------------------

const REL_COLORS: Record<string, string> = {
  imports: "text-blue-400",
  depends_on: "text-purple-400",
  exports: "text-cyan-400",
  calls: "text-amber-400",
  implements: "text-green-400",
  contains: "text-pink-400",
  references: "text-orange-400",
  uses_model: "text-violet-400",
  queries: "text-teal-400",
};

function getRelColor(type: string) {
  return REL_COLORS[type] ?? "text-text-muted";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface EntityDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ projectId?: string }>;
}

export default async function EntityDetailPage({ params, searchParams }: EntityDetailPageProps) {
  const { id } = await params;
  const { projectId } = await searchParams;
  if (!projectId) return <ProjectScopeRequired feature="Entity details" />;
  const result = await getEntityWithRelationships(id, projectId);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="rounded-2xl bg-white/5 p-6">
          <AlertCircle className="h-10 w-10 text-text-muted" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">
          Entity Not Found
        </h2>
        <p className="text-sm text-text-muted max-w-xs text-center">
          The entity <span className="text-text-secondary font-mono">{id}</span> could
          not be found in the knowledge graph.
        </p>
        <Link
          href={`/system-map?projectId=${encodeURIComponent(projectId)}`}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-accent-blue/10 border border-accent-blue/30 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-accent-blue/20 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to System Map
        </Link>
      </div>
    );
  }

  const { entity, relationships } = result;
  const cfg = getTypeConfig(entity.type);

  // Separate incoming & outgoing relationships
  const outgoing = relationships.filter((r) => r.source_id === id);
  const incoming = relationships.filter((r) => r.target_id === id);

  // Extract properties, filtering out internal fields
  const properties = entity.properties
    ? Object.entries(entity.properties).filter(
        ([key]) => !["id", "name", "type", "qualified_name", "description"].includes(key)
      )
    : [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-6 pt-20 animate-fade-in-up sm:px-6 lg:p-6">
      {/* ── Breadcrumb ─────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-sm text-text-muted">
        <Link
          href={`/system-map?projectId=${encodeURIComponent(projectId)}`}
          className="inline-flex items-center gap-1.5 hover:text-text-secondary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          System Map
        </Link>
        <span>/</span>
        <span className="text-text-secondary truncate">{entity.name}</span>
      </nav>

      {/* ── Entity Header ──────────────────────────────── */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-6">
        <div className="flex items-start gap-4">
          {/* Type icon */}
          <div
            className={`flex-none flex items-center justify-center w-14 h-14 rounded-2xl ${cfg.bg} ${cfg.color} text-2xl font-bold`}
          >
            {cfg.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-text-primary">{entity.name}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color} border border-current/20`}
              >
                {entity.type}
              </span>
            </div>

            {entity.qualified_name && (
              <p className="text-xs text-text-muted font-mono truncate mt-1">
                {entity.qualified_name}
              </p>
            )}

            {entity.description && (
              <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-3xl">
                {entity.description}
              </p>
            )}
          </div>
        </div>

        {/* Stat chips */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Hash className="h-3 w-3" />
            ID: <span className="font-mono text-text-secondary">{entity.id}</span>
          </span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span className="inline-flex items-center gap-1.5">
            <GitBranch className="h-3 w-3" />
            {relationships.length} relationship{relationships.length !== 1 ? "s" : ""}
          </span>
          {properties.length > 0 && (
            <>
              <span className="h-1 w-1 rounded-full bg-white/20" />
              <span className="inline-flex items-center gap-1.5">
                <Box className="h-3 w-3" />
                {properties.length} propert{properties.length !== 1 ? "ies" : "y"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Properties ─────────────────────────────────── */}
      {properties.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Box className="h-4 w-4 text-text-muted" />
            Properties
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {properties.map(([key, value]) => (
              <div
                key={key}
                className="rounded-lg bg-white/[0.02] border border-white/5 p-3"
              >
                <p className="text-[10px] text-text-muted font-medium uppercase tracking-wider mb-1">
                  {key.replace(/_/g, " ")}
                </p>
                <p className="text-sm text-text-primary font-mono break-all">
                  {typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Relationships ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outgoing */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpRight className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-text-primary">
              Outgoing
            </h2>
            <span className="ml-auto text-xs text-text-muted">
              {outgoing.length} relationship{outgoing.length !== 1 ? "s" : ""}
            </span>
          </div>
          {outgoing.length > 0 ? (
            <div className="space-y-2">
              {outgoing.map((rel, i) => (
                <Link
                  key={`out-${i}`}
                  href={`/system-map/${encodeURIComponent(rel.target_id)}?projectId=${encodeURIComponent(projectId)}`}
                  className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/5 p-3 hover:bg-white/[0.05] transition-colors group"
                >
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${getRelColor(rel.type)}`}
                  >
                    {rel.type}
                  </span>
                  <span className="text-sm text-text-secondary truncate flex-1 font-mono">
                    {rel.target_id}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted italic py-4 text-center">
              No outgoing relationships
            </p>
          )}
        </div>

        {/* Incoming */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowDownLeft className="h-4 w-4 text-green-400" />
            <h2 className="text-sm font-semibold text-text-primary">
              Incoming
            </h2>
            <span className="ml-auto text-xs text-text-muted">
              {incoming.length} relationship{incoming.length !== 1 ? "s" : ""}
            </span>
          </div>
          {incoming.length > 0 ? (
            <div className="space-y-2">
              {incoming.map((rel, i) => (
                <Link
                  key={`in-${i}`}
                  href={`/system-map/${encodeURIComponent(rel.source_id)}?projectId=${encodeURIComponent(projectId)}`}
                  className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/5 p-3 hover:bg-white/[0.05] transition-colors group"
                >
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 ${getRelColor(rel.type)}`}
                  >
                    {rel.type}
                  </span>
                  <span className="text-sm text-text-secondary truncate flex-1 font-mono">
                    {rel.source_id}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted italic py-4 text-center">
              No incoming relationships
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
