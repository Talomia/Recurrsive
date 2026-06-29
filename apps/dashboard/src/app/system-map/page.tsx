import Header from "@/components/header";
import { Network } from "lucide-react";

const NODES = [
  { id: "api-gateway", name: "API Gateway", type: "gateway", health: 98, x: 50, y: 30 },
  { id: "auth-service", name: "Auth Service", type: "service", health: 72, x: 25, y: 55 },
  { id: "user-service", name: "User Service", type: "service", health: 94, x: 50, y: 55 },
  { id: "order-service", name: "Order Service", type: "service", health: 68, x: 75, y: 55 },
  { id: "payment-service", name: "Payment Service", type: "service", health: 85, x: 40, y: 80 },
  { id: "notification-service", name: "Notification Service", type: "service", health: 96, x: 60, y: 80 },
  { id: "inventory-service", name: "Inventory Service", type: "service", health: 91, x: 80, y: 80 },
];

const EDGES = [
  { from: "api-gateway", to: "auth-service" },
  { from: "api-gateway", to: "user-service" },
  { from: "api-gateway", to: "order-service" },
  { from: "order-service", to: "payment-service" },
  { from: "order-service", to: "inventory-service" },
  { from: "user-service", to: "notification-service" },
  { from: "payment-service", to: "notification-service" },
];

function healthColor(h: number) {
  if (h >= 90) return { stroke: "#22c55e", fill: "#22c55e", bg: "bg-green-500/10", text: "text-green-400" };
  if (h >= 75) return { stroke: "#3b82f6", fill: "#3b82f6", bg: "bg-blue-500/10", text: "text-blue-400" };
  if (h >= 60) return { stroke: "#f59e0b", fill: "#f59e0b", bg: "bg-amber-500/10", text: "text-amber-400" };
  return { stroke: "#ef4444", fill: "#ef4444", bg: "bg-red-500/10", text: "text-red-400" };
}

export default function SystemMapPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="System Map" subtitle="Service topology and health visualization" />
      <div className="flex-1 p-6 space-y-6">
        {/* Map visualization */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
              <Network className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Service Topology</h3>
              <p className="text-xs text-text-muted">{NODES.length} services · {EDGES.length} connections</p>
            </div>
          </div>

          {/* SVG Map */}
          <div className="relative w-full aspect-[16/9] rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
            <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
              {/* Edges */}
              {EDGES.map((edge) => {
                const from = NODES.find((n) => n.id === edge.from);
                const to = NODES.find((n) => n.id === edge.to);
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
              {NODES.map((node) => {
                const c = healthColor(node.health);
                return (
                  <g key={node.id}>
                    {/* Glow */}
                    <circle cx={node.x} cy={node.y} r="4" fill={c.fill} opacity="0.1" />
                    {/* Node circle */}
                    <circle cx={node.x} cy={node.y} r="2.5" fill="#0f1629" stroke={c.stroke} strokeWidth="0.4" />
                    {/* Health dot */}
                    <circle cx={node.x} cy={node.y} r="1" fill={c.fill} opacity="0.8" />
                    {/* Label */}
                    <text x={node.x} y={node.y + 5} textAnchor="middle" fill="#94a3b8" fontSize="2.2" fontFamily="Inter, sans-serif">
                      {node.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Node list */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
          {NODES.map((node) => {
            const c = healthColor(node.health);
            return (
              <div key={node.id} className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text-primary">{node.name}</span>
                  <span className={`text-xs font-semibold ${c.text}`}>{node.health}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-muted capitalize">{node.type}</span>
                  <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full rounded-full`} style={{ width: `${node.health}%`, backgroundColor: c.fill }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
