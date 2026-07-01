'use client';

/**
 * Simulation Engine page.
 *
 * Run and review simulations with impact scores, risk levels, and event timelines.
 */

import { useState } from 'react';
import { FlaskConical, Play, AlertTriangle, TrendingUp, Clock, Zap } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SimulationEvent {
  time: string;
  label: string;
  impact: number;
}

interface Simulation {
  id: string;
  name: string;
  type: 'monte-carlo' | 'stress-test' | 'what-if' | 'chaos';
  status: 'completed' | 'running' | 'queued' | 'failed';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  impactScore: number;
  duration: string;
  createdAt: string;
  metrics: { label: string; value: string }[];
  timeline: SimulationEvent[];
}

// ─── Demo Data ───────────────────────────────────────────────────────────────

const SIMULATIONS: Simulation[] = [
  {
    id: 'sim-001', name: 'Dependency Cascade Failure', type: 'chaos',
    status: 'completed', riskLevel: 'critical', impactScore: 92, duration: '4m 12s',
    createdAt: '2026-06-30', metrics: [{ label: 'Affected Services', value: '14' }, { label: 'Recovery Time', value: '38m' }],
    timeline: [{ time: '0:00', label: 'Inject failure', impact: -5 }, { time: '0:45', label: 'Cascade begins', impact: -32 }, { time: '2:10', label: 'Alert triggered', impact: 0 }, { time: '4:12', label: 'Recovery complete', impact: 18 }],
  },
  {
    id: 'sim-002', name: 'Traffic Spike 10x', type: 'stress-test',
    status: 'completed', riskLevel: 'high', impactScore: 74, duration: '8m 03s',
    createdAt: '2026-06-29', metrics: [{ label: 'P99 Latency', value: '2.4s' }, { label: 'Error Rate', value: '3.1%' }],
    timeline: [{ time: '0:00', label: 'Ramp up traffic', impact: -2 }, { time: '3:00', label: 'Peak load', impact: -28 }, { time: '6:00', label: 'Auto-scale kicks in', impact: 12 }, { time: '8:03', label: 'Stabilized', impact: 5 }],
  },
  {
    id: 'sim-003', name: 'Config Drift Projection', type: 'what-if',
    status: 'completed', riskLevel: 'medium', impactScore: 45, duration: '1m 58s',
    createdAt: '2026-06-28', metrics: [{ label: 'Drift Items', value: '7' }, { label: 'Compliance Gap', value: '12%' }],
    timeline: [{ time: '0:00', label: 'Baseline captured', impact: 0 }, { time: '0:30', label: 'Drift injected', impact: -15 }, { time: '1:58', label: 'Report generated', impact: 0 }],
  },
  {
    id: 'sim-004', name: 'Cost Optimization Model', type: 'monte-carlo',
    status: 'running', riskLevel: 'low', impactScore: 28, duration: '—',
    createdAt: '2026-07-01', metrics: [{ label: 'Iterations', value: '4,200 / 10,000' }, { label: 'Est. Savings', value: '$12.4k/mo' }],
    timeline: [{ time: '0:00', label: 'Sampling started', impact: 0 }],
  },
  {
    id: 'sim-005', name: 'Security Posture Breach', type: 'chaos',
    status: 'queued', riskLevel: 'high', impactScore: 0, duration: '—',
    createdAt: '2026-07-01', metrics: [],
    timeline: [],
  },
];

const SIM_TYPES = ['monte-carlo', 'stress-test', 'what-if', 'chaos'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    queued: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${m[status] ?? ''}`}>{status}</span>;
}

function RiskDot({ level }: { level: string }) {
  const c: Record<string, string> = { low: 'bg-green-400', medium: 'bg-yellow-400', high: 'bg-red-400', critical: 'bg-purple-400' };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${c[level]}`} title={level} />;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SimulationPage() {
  const [selected, setSelected] = useState<Simulation | null>(SIMULATIONS[0]);
  const [newType, setNewType] = useState<string>(SIM_TYPES[0]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <FlaskConical className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
          Simulation Engine
        </h1>
        <p className="text-sm text-text-secondary mt-1">Run chaos, stress, what-if, and Monte Carlo simulations against your systems.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Simulations', value: SIMULATIONS.length, icon: FlaskConical },
          { label: 'Running', value: SIMULATIONS.filter(s => s.status === 'running').length, icon: Play },
          { label: 'Avg Impact', value: Math.round(SIMULATIONS.filter(s => s.impactScore > 0).reduce((a, s) => a + s.impactScore, 0) / SIMULATIONS.filter(s => s.impactScore > 0).length), icon: TrendingUp },
          { label: 'Critical Risk', value: SIMULATIONS.filter(s => s.riskLevel === 'critical').length, icon: AlertTriangle },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-xs text-text-tertiary uppercase">{k.label}</p>
            <p className="text-2xl font-bold text-text-primary">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Simulations Table */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
          <h3 className="text-lg font-semibold text-text-primary">Simulations</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-text-tertiary text-xs uppercase">
              <th className="pb-3">Name</th><th className="pb-3">Type</th><th className="pb-3">Status</th><th className="pb-3">Risk</th><th className="pb-3">Impact</th><th className="pb-3">Duration</th><th className="pb-3" />
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {SIMULATIONS.map(s => (
                <tr key={s.id} className="hover:bg-white/5 cursor-pointer" onClick={() => setSelected(s)}>
                  <td className="py-3 text-text-primary font-medium">{s.name}</td>
                  <td className="py-3 text-text-secondary">{s.type}</td>
                  <td className="py-3"><StatusBadge status={s.status} /></td>
                  <td className="py-3"><div className="flex items-center gap-1.5"><RiskDot level={s.riskLevel} /><span className="text-text-secondary capitalize">{s.riskLevel}</span></div></td>
                  <td className="py-3 text-text-primary font-semibold">{s.impactScore}</td>
                  <td className="py-3 text-text-secondary">{s.duration}</td>
                  <td className="py-3"><Play className="w-4 h-4 text-text-tertiary" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Detail + Timeline */}
      {selected && selected.timeline.length > 0 && (
        <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-text-primary">Timeline — {selected.name}</h3>
          </div>

          {selected.metrics.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {selected.metrics.map(m => (
                <div key={m.label} className="p-3 rounded-lg text-center" style={{ background: 'var(--color-base)' }}>
                  <p className="text-xs text-text-tertiary">{m.label}</p>
                  <p className="text-lg font-bold text-text-primary">{m.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            {selected.timeline.map((e, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
                <span className="text-xs text-text-tertiary min-w-[48px]">{e.time}</span>
                <span className="text-sm text-text-primary flex-1">{e.label}</span>
                <span className={`text-xs font-semibold ${e.impact > 0 ? 'text-green-400' : e.impact < 0 ? 'text-red-400' : 'text-text-tertiary'}`}>
                  {e.impact > 0 ? '+' : ''}{e.impact}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Simulation */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-lg font-semibold text-text-primary mb-4">New Simulation</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {SIM_TYPES.map(t => (
            <button key={t} onClick={() => setNewType(t)}
              className="px-3 py-2 rounded-lg text-xs font-medium transition-all capitalize"
              style={{
                background: newType === t ? 'var(--color-accent)' : 'var(--color-base)',
                color: newType === t ? '#fff' : 'var(--color-text-secondary)',
                border: `1px solid ${newType === t ? 'var(--color-accent)' : 'var(--color-border)'}`,
              }}>
              {t}
            </button>
          ))}
        </div>
        <button className="w-full py-2 rounded-lg font-medium text-sm text-white" style={{ background: 'var(--color-accent)' }}>
          Launch {newType} Simulation
        </button>
      </div>
    </div>
  );
}
