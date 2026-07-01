'use client';

/**
 * Confidence Calibration page.
 *
 * Brier score, calibration curve, analyzer accuracy, and recent predictions.
 */

import { useState } from 'react';
import { Target, TrendingUp, CheckCircle, XCircle, BarChart3, Brain } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalibrationBucket {
  predicted: string;
  count: number;
  actualRate: number;
  deviation: number;
}

interface AnalyzerScore {
  name: string;
  accuracy: number;
  predictions: number;
  brierScore: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface Prediction {
  id: string;
  description: string;
  confidence: number;
  outcome: 'correct' | 'incorrect' | 'pending';
  date: string;
  analyzer: string;
}

// ─── Demo Data ───────────────────────────────────────────────────────────────

const OVERALL_BRIER = 0.142;

const BUCKETS: CalibrationBucket[] = [
  { predicted: '0–10%', count: 42, actualRate: 0.07, deviation: -0.02 },
  { predicted: '10–20%', count: 38, actualRate: 0.16, deviation: 0.01 },
  { predicted: '20–30%', count: 55, actualRate: 0.28, deviation: 0.03 },
  { predicted: '30–40%', count: 47, actualRate: 0.33, deviation: -0.02 },
  { predicted: '40–50%', count: 61, actualRate: 0.48, deviation: 0.03 },
  { predicted: '50–60%', count: 53, actualRate: 0.52, deviation: -0.03 },
  { predicted: '60–70%', count: 66, actualRate: 0.68, deviation: 0.03 },
  { predicted: '70–80%', count: 71, actualRate: 0.73, deviation: -0.02 },
  { predicted: '80–90%', count: 58, actualRate: 0.86, deviation: 0.01 },
  { predicted: '90–100%', count: 44, actualRate: 0.93, deviation: -0.02 },
];

const ANALYZERS: AnalyzerScore[] = [
  { name: 'Security Analyzer', accuracy: 92, predictions: 214, brierScore: 0.098, trend: 'improving' },
  { name: 'Dependency Analyzer', accuracy: 87, predictions: 186, brierScore: 0.131, trend: 'stable' },
  { name: 'Architecture Analyzer', accuracy: 84, predictions: 158, brierScore: 0.162, trend: 'improving' },
  { name: 'Performance Analyzer', accuracy: 79, predictions: 132, brierScore: 0.194, trend: 'declining' },
  { name: 'Compliance Analyzer', accuracy: 91, predictions: 98, brierScore: 0.108, trend: 'stable' },
];

const PREDICTIONS: Prediction[] = [
  { id: 'pred-1', description: 'CVE-2026-1234 will impact production within 7 days', confidence: 0.85, outcome: 'correct', date: '2026-06-30', analyzer: 'Security Analyzer' },
  { id: 'pred-2', description: 'Dependency lodash@4 will release breaking change', confidence: 0.62, outcome: 'incorrect', date: '2026-06-29', analyzer: 'Dependency Analyzer' },
  { id: 'pred-3', description: 'API latency will exceed P99 threshold this week', confidence: 0.74, outcome: 'correct', date: '2026-06-28', analyzer: 'Performance Analyzer' },
  { id: 'pred-4', description: 'GDPR audit finding likelihood > 50%', confidence: 0.55, outcome: 'pending', date: '2026-07-01', analyzer: 'Compliance Analyzer' },
  { id: 'pred-5', description: 'Microservice coupling will increase beyond threshold', confidence: 0.41, outcome: 'incorrect', date: '2026-06-27', analyzer: 'Architecture Analyzer' },
  { id: 'pred-6', description: 'Container image vulnerability discovered in next scan', confidence: 0.91, outcome: 'correct', date: '2026-06-26', analyzer: 'Security Analyzer' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: string }) {
  const m: Record<string, { cls: string; icon: typeof CheckCircle }> = {
    correct: { cls: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
    incorrect: { cls: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
    pending: { cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Target },
  };
  const { cls, icon: Icon } = m[outcome] ?? m.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <Icon className="w-3 h-3" />{outcome}
    </span>
  );
}

function TrendLabel({ trend }: { trend: string }) {
  const c: Record<string, string> = { improving: 'text-green-400', stable: 'text-yellow-400', declining: 'text-red-400' };
  return <span className={`text-xs capitalize ${c[trend] ?? 'text-text-tertiary'}`}>{trend}</span>;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ConfidencePage() {
  const [view, setView] = useState<'overview' | 'predictions'>('overview');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Target className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
          Confidence Calibration
        </h1>
        <p className="text-sm text-text-secondary mt-1">Measure how well our predictions match reality.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs text-text-tertiary uppercase">Brier Score</p>
          <p className="text-2xl font-bold text-green-400">{OVERALL_BRIER.toFixed(3)}</p>
          <p className="text-xs text-text-tertiary">Lower is better</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs text-text-tertiary uppercase">Total Predictions</p>
          <p className="text-2xl font-bold text-text-primary">{PREDICTIONS.length}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs text-text-tertiary uppercase">Correct Rate</p>
          <p className="text-2xl font-bold text-text-primary">{Math.round(PREDICTIONS.filter(p => p.outcome === 'correct').length / PREDICTIONS.filter(p => p.outcome !== 'pending').length * 100)}%</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs text-text-tertiary uppercase">Analyzers Tracked</p>
          <p className="text-2xl font-bold text-text-primary">{ANALYZERS.length}</p>
        </div>
      </div>

      {/* Toggle */}
      <div className="flex gap-2">
        {(['overview', 'predictions'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
            style={{
              background: view === v ? 'var(--color-accent)' : 'var(--color-surface)',
              color: view === v ? '#fff' : 'var(--color-text-secondary)',
              border: `1px solid ${view === v ? 'var(--color-accent)' : 'var(--color-border)'}`,
            }}>
            {v}
          </button>
        ))}
      </div>

      {view === 'overview' && (
        <>
          {/* Calibration Curve Table */}
          <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
              <h3 className="text-lg font-semibold text-text-primary">Calibration Curve</h3>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-text-tertiary text-xs uppercase">
                <th className="pb-3">Predicted Range</th><th className="pb-3">Count</th><th className="pb-3">Actual Rate</th><th className="pb-3">Deviation</th><th className="pb-3">Calibration</th>
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {BUCKETS.map(b => (
                  <tr key={b.predicted}>
                    <td className="py-2 text-text-primary font-medium">{b.predicted}</td>
                    <td className="py-2 text-text-secondary">{b.count}</td>
                    <td className="py-2 text-text-primary">{(b.actualRate * 100).toFixed(0)}%</td>
                    <td className="py-2">
                      <span className={Math.abs(b.deviation) <= 0.03 ? 'text-green-400' : 'text-yellow-400'}>
                        {b.deviation > 0 ? '+' : ''}{(b.deviation * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="w-20 h-2 rounded-full" style={{ background: 'var(--color-base)' }}>
                        <div className="h-2 rounded-full bg-green-400" style={{ width: `${Math.max(5, 100 - Math.abs(b.deviation) * 1000)}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per-Analyzer */}
          <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
              <h3 className="text-lg font-semibold text-text-primary">Analyzer Accuracy</h3>
            </div>
            <div className="space-y-3">
              {ANALYZERS.map(a => (
                <div key={a.name} className="flex items-center gap-4 p-3 rounded-xl" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-text-primary">{a.name}</p>
                    <p className="text-xs text-text-tertiary">{a.predictions} predictions · Brier: {a.brierScore.toFixed(3)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-text-primary">{a.accuracy}%</p>
                    <TrendLabel trend={a.trend} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {view === 'predictions' && (
        <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
            <h3 className="text-lg font-semibold text-text-primary">Recent Predictions</h3>
          </div>
          <div className="space-y-3">
            {PREDICTIONS.map(p => (
              <div key={p.id} className="flex items-start gap-4 p-3 rounded-xl" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
                <div className="flex-1">
                  <p className="text-sm text-text-primary">{p.description}</p>
                  <p className="text-xs text-text-tertiary mt-1">{p.analyzer} · {p.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-text-primary">{Math.round(p.confidence * 100)}%</span>
                  <OutcomeBadge outcome={p.outcome} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
