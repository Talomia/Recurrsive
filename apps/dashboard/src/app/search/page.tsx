import Header from "@/components/header";
import { Search, Box, Code, FileCode, Database, GitBranch, ArrowRight, Filter, Hash } from "lucide-react";
import { searchGraphEntities, getGraphStats } from "@/lib/api";
import type { GraphEntity } from "@/lib/api";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Entity type styling
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
// Page component
// ---------------------------------------------------------------------------

interface SearchPageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q ?? "";
  const typeFilter = params.type ?? "";

  // Fetch stats for entity type counts
  const stats = await getGraphStats();
  const entityTypes = Object.entries(stats?.entities_by_type ?? {})
    .sort(([, a], [, b]) => b - a);

  // Perform search if query provided
  let results: GraphEntity[] = [];
  if (query.trim()) {
    results = await searchGraphEntities(
      query.trim(),
      typeFilter || undefined,
      50,
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header
        title="Search"
        subtitle="Full-text search across the knowledge graph"
      />

      {/* Search form */}
      <form
        action="/search"
        method="get"
        className="flex flex-col gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search entities by name, qualified name, or description…"
              className="w-full rounded-2xl bg-white/5 border border-white/10 py-3 pl-12 pr-4 text-text-primary placeholder:text-text-muted outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/30 transition-all text-sm"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="rounded-2xl bg-accent-blue/20 border border-accent-blue/30 px-6 py-3 text-sm font-medium text-blue-300 hover:bg-accent-blue/30 transition-colors"
          >
            Search
          </button>
        </div>

        {/* Type filter chips */}
        {entityTypes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={query ? `/search?q=${encodeURIComponent(query)}` : "/search"}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                !typeFilter
                  ? "bg-accent-blue/20 border-accent-blue/40 text-blue-300"
                  : "bg-white/5 border-white/10 text-text-muted hover:bg-white/10"
              }`}
            >
              All
            </Link>
            {entityTypes.map(([type, count]) => {
              const cfg = getTypeConfig(type);
              const isActive = typeFilter === type;
              return (
                <Link
                  key={type}
                  href={`/search?q=${encodeURIComponent(query)}&type=${type}`}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    isActive
                      ? `${cfg.bg} border-current ${cfg.color}`
                      : "bg-white/5 border-white/10 text-text-muted hover:bg-white/10"
                  }`}
                >
                  {type} <span className="opacity-60">({count})</span>
                </Link>
              );
            })}
          </div>
        )}
      </form>

      {/* Results */}
      {query.trim() ? (
        results.length > 0 ? (
          <div className="space-y-1">
            <p className="text-sm text-text-muted mb-3">
              Found <span className="text-text-primary font-medium">{results.length}</span>{" "}
              {results.length === 1 ? "entity" : "entities"}
              {typeFilter ? ` of type "${typeFilter}"` : ""}
            </p>
            <div className="rounded-2xl border border-white/10 overflow-hidden divide-y divide-white/5">
              {results.map((entity) => {
                const cfg = getTypeConfig(entity.type);
                return (
                  <div
                    key={entity.id}
                    className="group flex items-start gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors"
                  >
                    {/* Type badge */}
                    <div
                      className={`flex-none flex items-center justify-center w-10 h-10 rounded-xl ${cfg.bg} ${cfg.color} text-lg font-bold mt-0.5`}
                    >
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-text-primary truncate">
                          {entity.name}
                        </h3>
                        <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.color} border border-current/20`}>
                          {entity.type}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted font-mono truncate">
                        {entity.qualified_name}
                      </p>
                      {entity.description && (
                        <p className="mt-1 text-xs text-text-muted line-clamp-2">
                          {entity.description}
                        </p>
                      )}
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="flex-none h-4 w-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity mt-3" />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-2xl bg-white/5 p-4 mb-4">
              <Search className="h-8 w-8 text-text-muted" />
            </div>
            <h3 className="text-sm font-medium text-text-primary mb-1">No results found</h3>
            <p className="text-xs text-text-muted max-w-xs">
              No entities match &ldquo;{query}&rdquo;{typeFilter ? ` with type "${typeFilter}"` : ""}.
              Try a broader search or different type filter.
            </p>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-2xl bg-accent-blue/10 p-4 mb-4">
            <Search className="h-8 w-8 text-blue-400" />
          </div>
          <h3 className="text-sm font-medium text-text-primary mb-1">
            Search the Knowledge Graph
          </h3>
          <p className="text-xs text-text-muted max-w-xs">
            Search across all entities — functions, classes, modules, endpoints,
            and more. Uses full-text search with relevance ranking.
          </p>
          {entityTypes.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-md">
              {entityTypes.slice(0, 8).map(([type, count]) => {
                const cfg = getTypeConfig(type);
                return (
                  <span
                    key={type}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${cfg.bg} ${cfg.color}`}
                  >
                    {count} {type}{count !== 1 ? "s" : ""}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
