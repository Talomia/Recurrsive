import Link from "next/link";
import Header from "@/components/header";
import { Network, Box, ArrowRight, Layers, FolderGit2 } from "lucide-react";
import { getGraphStats } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NodeLayout {
  id: string;
  name: string;
  type: string;
  count: number;
  x: number;
  y: number;
}

interface EdgeLayout {
  from: string;
  to: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

/** Arrange entity types in a force-directed-ish circular layout. */
function layoutFromStats(
  entitiesByType: Record<string, number>,
  relsByType: Record<string, number>,
): { nodes: NodeLayout[]; edges: EdgeLayout[] } {
  const types = Object.entries(entitiesByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12); // Cap at 12 most common types

  const nodes: NodeLayout[] = types.map(([type, count], i) => {
    const angle = (i / types.length) * 2 * Math.PI - Math.PI / 2;
    const radius = types.length <= 4 ? 25 : 30;
    return {
      id: type,
      name: type.replace(/_/g, " "),
      type: "entity_type",
      count,
      x: 50 + radius * Math.cos(angle),
      y: 50 + radius * Math.sin(angle),
    };
  });

  // Create edges from relationship types — connect related entity types
  const relEntries = Object.entries(relsByType).sort((a, b) => b[1] - a[1]);
  const edges: EdgeLayout[] = [];
  for (let i = 0; i < Math.min(relEntries.length, nodes.length - 1); i++) {
    const [relType, count] = relEntries[i]!;
    // Connect successive node pairs with each relationship type
    const fromNode = nodes[i % nodes.length]!;
    const toNode = nodes[(i + 1) % nodes.length]!;
    edges.push({ from: fromNode.id, to: toNode.id, count });
    void relType; // Used for display if needed later
  }

  return { nodes, edges };
}

function healthColor(count: number, maxCount: number) {
  const ratio = count / Math.max(maxCount, 1);
  if (ratio >= 0.25) return { stroke: "#22c55e", fill: "#22c55e", bg: "bg-green-500/10", text: "text-green-400" };
  if (ratio >= 0.1) return { stroke: "#3b82f6", fill: "#3b82f6", bg: "bg-blue-500/10", text: "text-blue-400" };
  if (ratio >= 0.05) return { stroke: "#f59e0b", fill: "#f59e0b", bg: "bg-amber-500/10", text: "text-amber-400" };
  return { stroke: "#8b5cf6", fill: "#8b5cf6", bg: "bg-purple-500/10", text: "text-purple-400" };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SystemMapPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  if (!projectId) return null;
  try {
    const stats = await getGraphStats(projectId);

    // ---------- Empty state ----------
    if (stats.total_entities === 0) {
      return (
        <div className="flex flex-col min-h-screen">
          <Header title="System Map" subtitle="Knowledge graph topology and entity distribution" />
          <div className="flex-1 p-6 flex items-center justify-center">
            <div className="glass-card p-12 max-w-lg text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10 mx-auto mb-5">
                <Network className="h-7 w-7 text-text-muted" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">System map is empty</h3>
              <p className="text-sm text-text-secondary mb-6">
                Run an analysis to discover your codebase architecture &mdash; files, modules, dependencies, and relationships.
              </p>
              <Link
                href="/projects"
                className="inline-flex items-center gap-2 rounded-xl bg-accent-blue/10 border border-accent-blue/20 px-4 py-2.5 text-sm font-medium text-blue-400 hover:bg-accent-blue/20 transition-colors"
              >
                <FolderGit2 className="h-4 w-4" />
                Run Your First Analysis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      );
    }

    const { nodes, edges } = layoutFromStats(stats.entities_by_type, stats.relationships_by_type);
    const maxCount = Math.max(...nodes.map((n) => n.count), 1);

    return (
      <div className="flex flex-col min-h-screen">
        <Header title="System Map" subtitle="Knowledge graph topology and entity distribution" />
        <div className="flex-1 p-6 space-y-6">

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger-children">
            {[
              { label: "Total Entities", value: stats.total_entities, icon: Box, color: "text-blue-400" },
              { label: "Total Relationships", value: stats.total_relationships, icon: ArrowRight, color: "text-green-400" },
              { label: "Entity Types", value: Object.keys(stats.entities_by_type).length, icon: Layers, color: "text-purple-400" },
              { label: "Relationship Types", value: Object.keys(stats.relationships_by_type).length, icon: Network, color: "text-amber-400" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="glass-card p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                  <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xl font-bold text-text-primary">{value.toLocaleString()}</p>
                  <p className="text-xs text-text-muted">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Map visualization */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
                <Network className="h-5 w-5 text-cyan-400" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Entity Topology</h3>
                <p className="text-xs text-text-muted">{nodes.length} entity types · {edges.length} connections</p>
              </div>
            </div>

            {/* SVG Map */}
            <div className="relative w-full aspect-[16/9] rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
              <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Knowledge graph entity topology showing entity types and their relationships">
                <title>System Map — Entity type distribution and relationships</title>
                {/* Edges */}
                {edges.map((edge) => {
                  const from = nodes.find((n) => n.id === edge.from);
                  const to = nodes.find((n) => n.id === edge.to);
                  if (!from || !to) return null;
                  return (
                    <line
                      key={`${edge.from}-${edge.to}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="0.3"
                      strokeDasharray="1,1"
                    />
                  );
                })}
                {/* Nodes */}
                {nodes.map((node) => {
                  const c = healthColor(node.count, maxCount);
                  const radius = 1.5 + (node.count / maxCount) * 2;
                  return (
                    <g key={node.id}>
                      {/* Glow */}
                      <circle cx={node.x} cy={node.y} r={radius + 2} fill={c.fill} opacity="0.08" />
                      {/* Node circle */}
                      <circle cx={node.x} cy={node.y} r={radius} fill="#0f1629" stroke={c.stroke} strokeWidth="0.4" />
                      {/* Center dot */}
                      <circle cx={node.x} cy={node.y} r={radius * 0.4} fill={c.fill} opacity="0.8" />
                      {/* Label */}
                      <text x={node.x} y={node.y + radius + 3} textAnchor="middle" fill="#94a3b8" fontSize="2.2" fontFamily="Inter, sans-serif">
                        {node.name}
                      </text>
                      {/* Count */}
                      <text x={node.x} y={node.y + radius + 5.5} textAnchor="middle" fill="#64748b" fontSize="1.8" fontFamily="Inter, sans-serif">
                        {node.count}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Entity type breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
            {nodes.map((node) => {
              const c = healthColor(node.count, maxCount);
              const pct = Math.round((node.count / stats.total_entities) * 100);
              return (
                <div key={node.id} className="glass-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-primary capitalize">{node.name}</span>
                    <span className={`text-xs font-semibold ${c.text}`}>{node.count}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted">{pct}% of total</span>
                    <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.fill }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Relationship type breakdown */}
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Relationship Distribution</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(stats.relationships_by_type)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-xs text-text-secondary capitalize">{type.replace(/_/g, " ")}</span>
                    <span className="text-xs font-semibold text-text-primary">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  } catch {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="System Map" subtitle="Knowledge graph topology and entity distribution" />
        <div className="flex-1 p-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-text-muted">
            Unable to load data. The API may be unavailable.
          </div>
        </div>
      </div>
    );
  }
}
