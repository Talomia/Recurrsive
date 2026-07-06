'use client';
/**
 * Confidence Calibration page.
 *
 * Brier score, calibration curve, analyzer accuracy, and recent predictions.
 */

import { useState, useEffect } from 'react';
import { Target, TrendingUp, CheckCircle, XCircle, BarChart3, Brain, Loader2 } from 'lucide-react';
import { getConfidenceData } from '@/lib/api';
import type { ConfidenceData } from '@/lib/api';

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
  const [data, setData] = useState<ConfidenceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConfidenceData()
      .then(setData)
      .catch(() => {
        /* API unavailable – set proper empty state */
        setData({
          brierScore: 0,
          brierTrend: 0,
          calibration: [],
          analyzerAccuracy: [],
          recentPredictions: [],
          totalPredictions: 0,
          accuracy: 0,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-accent)' }} />
      </div>
    );
  }

  // Derive display data from API response
  const brierScore = data.brierScore ?? 0;
  const calibration: CalibrationBucket[] = data.calibration ?? [];
  const analyzers: AnalyzerScore[] = (data.analyzerAccuracy ?? []).map(a => ({
    name: a.name,
    accuracy: a.accuracy,
    predictions: a.predictions,
    brierScore: a.accuracy > 0 ? (1 - a.accuracy / 100) * 0.25 : 0.25,
    trend: a.accuracy >= 90 ? 'improving' as const : a.accuracy >= 80 ? 'stable' as const : 'declining' as const,
  }));
  const predictions: Prediction[] = (data.recentPredictions ?? []).map(p => ({
    id: p.id,
    description: p.description,
    confidence: p.predicted,
    outcome: p.actual === null ? 'pending' as const : p.actual ? 'correct' as const : 'incorrect' as const,
    date: p.date,
    analyzer: p.source,
  }));
  const totalPredictions = data.totalPredictions ?? 0;
  const accuracy = data.accuracy ?? 0;

  if (totalPredictions === 0 && calibration.length === 0 && analyzers.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Target className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
            Confidence Calibration
          </h1>
          <p className="text-sm text-text-secondary mt-1">Measure how well our predictions match reality.</p>
        </div>
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <Target className="w-12 h-12 mx-auto text-text-tertiary mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-2">No Confidence Data Yet</h3>
          <p className="text-text-secondary text-sm">Run an analysis to start tracking prediction accuracy and calibration metrics.</p>
        </div>
      </div>
    );
  }

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
          <p className="text-2xl font-bold text-green-400">{brierScore.toFixed(3)}</p>
          <p className="text-xs text-text-tertiary">Lower is better</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs text-text-tertiary uppercase">Total Predictions</p>
          <p className="text-2xl font-bold text-text-primary">{totalPredictions}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs text-text-tertiary uppercase">Correct Rate</p>
          <p className="text-2xl font-bold text-text-primary">{Math.round(accuracy)}%</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs text-text-tertiary uppercase">Analyzers Tracked</p>
          <p className="text-2xl font-bold text-text-primary">{analyzers.length}</p>
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
                {calibration.map(b => (
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
              {analyzers.map(a => (
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
            {predictions.map(p => (
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
