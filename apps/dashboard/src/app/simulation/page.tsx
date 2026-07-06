'use client';
/**
 * Simulation Engine page.
 *
 * Run and review simulations with impact scores, risk levels, and event timelines.
 */

import { useState, useEffect } from 'react';
import { FlaskConical, Play, AlertTriangle, TrendingUp, Clock, Zap, Loader2 } from 'lucide-react';
import { getSimulations, createSimulation } from '@/lib/api';
import type { SimulationScenario } from '@/lib/api';
// Types reuse SimulationScenario from api.ts
type Simulation = SimulationScenario;

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
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Simulation | null>(null);
  const [newType, setNewType] = useState<string>(SIM_TYPES[0]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSimulations()
      .then(data => {
        setSimulations(data);
        if (data.length > 0) setSelected(data[0]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load simulations.'))
      .finally(() => setLoading(false));
  }, []);

  const handleLaunch = async () => {
    setCreating(true);
    setError(null);
    try {
      await createSimulation({ name: `${newType} simulation`, type: newType as SimulationScenario['type'] });
      const data = await getSimulations();
      setSimulations(data);
      if (data.length > 0) setSelected(data[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create simulation');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-accent)' }} />
      </div>
    );
  }

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
          { label: 'Total Simulations', value: simulations.length, icon: FlaskConical },
          { label: 'Running', value: simulations.filter(s => s.status === 'running').length, icon: Play },
          { label: 'Avg Impact', value: simulations.filter(s => s.impactScore > 0).length > 0 ? Math.round(simulations.filter(s => s.impactScore > 0).reduce((a, s) => a + s.impactScore, 0) / simulations.filter(s => s.impactScore > 0).length) : 0, icon: TrendingUp },
          { label: 'Critical Risk', value: simulations.filter(s => s.riskLevel === 'critical').length, icon: AlertTriangle },
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
              {simulations.map(s => (
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
        {error && (
          <p className="text-xs text-red-400 mb-3">{error}</p>
        )}
        <button
          onClick={handleLaunch}
          disabled={creating}
          className="w-full py-2 rounded-lg font-medium text-sm text-white disabled:opacity-50 transition-all"
          style={{ background: 'var(--color-accent)' }}
        >
          {creating ? 'Launching…' : `Launch ${newType} Simulation`}
        </button>
      </div>
    </div>
  );
}
