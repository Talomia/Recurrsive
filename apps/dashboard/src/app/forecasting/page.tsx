'use client';
/**
 * Forecasting & Intelligence page with Confidence tab.
 *
 * Health trajectory prediction, what-if analysis, evolution graph,
 * and confidence calibration metrics.
 */

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Zap, GitBranch, ChevronRight, ArrowUp, ArrowDown, Minus, Target, Brain, Loader2, CheckCircle, XCircle, BarChart3 } from 'lucide-react';
import {
  getForecast,
  getEvolution,
  getWhatIfAnalysis,
  getConfidenceData,
  type ForecastData,
  type EvolutionData,
  type WhatIfResult,
  type ConfidenceData,
} from '@/lib/api';
import Header from '@/components/header';
import ErrorBanner from '@/components/error-banner';
import LoadingSkeleton from '@/components/loading-skeleton';

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS = ['Forecasting', 'Confidence'] as const;
type Tab = typeof TABS[number];

// ---------------------------------------------------------------------------
// Forecasting Components
// ---------------------------------------------------------------------------

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'improving') return <ArrowUp className="w-4 h-4 text-green-400" />;
  if (trend === 'declining') return <ArrowDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-yellow-400" />;
}

function EventTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    decision: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    milestone: 'bg-green-500/20 text-green-400 border-green-500/30',
    incident: 'bg-red-500/20 text-red-400 border-red-500/30',
    experiment: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${colors[type] ?? 'bg-gray-500/20 text-gray-400'}`}>
      {type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// What-If Panel
// ---------------------------------------------------------------------------

const ACTION_TYPES = [
  { type: 'fix-critical-findings', label: 'Fix Critical Findings' },
  { type: 'add-tests', label: 'Add Test Coverage' },
  { type: 'upgrade-dependencies', label: 'Upgrade Dependencies' },
  { type: 'add-monitoring', label: 'Add Monitoring' },
  { type: 'refactor-architecture', label: 'Refactor Architecture' },
  { type: 'add-documentation', label: 'Improve Documentation' },
  { type: 'enable-strict-mode', label: 'Enable TypeScript Strict Mode' },
  { type: 'fix-security-issues', label: 'Fix Security Issues' },
  { type: 'optimize-performance', label: 'Optimize Performance' },
];

function WhatIfPanel() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  const simulate = useCallback(async () => {
    if (selected.size === 0) return;
    setLoading(true);
    setSimError(null);
    try {
      const actions = Array.from(selected).map(type => ({
        type,
        description: ACTION_TYPES.find(a => a.type === type)?.label ?? type,
      }));
      const data = await getWhatIfAnalysis({ actions });
      setResult(data);
    } catch (e) {
      setSimError(e instanceof Error ? e.message : 'What-if simulation failed.');
    }
    setLoading(false);
  }, [selected]);

  const toggle = (type: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
    setResult(null);
  };

  return (
    <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-yellow-400" />
        <h3 className="text-lg font-semibold text-text-primary">What-If Analysis</h3>
      </div>
      <p className="text-sm text-text-secondary mb-4">Select actions to simulate their impact on your health score.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        {ACTION_TYPES.map(a => (
          <button
            key={a.type}
            onClick={() => toggle(a.type)}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-all text-left"
            style={{
              background: selected.has(a.type) ? 'var(--color-accent)' : 'var(--color-base)',
              color: selected.has(a.type) ? '#fff' : 'var(--color-text-secondary)',
              border: `1px solid ${selected.has(a.type) ? 'var(--color-accent)' : 'var(--color-border)'}`,
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      <button
        onClick={simulate}
        disabled={selected.size === 0 || loading}
        className="w-full py-2 rounded-lg font-medium text-sm transition-all"
        style={{
          background: selected.size > 0 ? 'var(--color-accent)' : 'var(--color-base)',
          color: selected.size > 0 ? '#fff' : 'var(--color-text-tertiary)',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Simulating...' : `Simulate ${selected.size} Action${selected.size !== 1 ? 's' : ''}`}
      </button>

      {simError && (
        <p className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {simError}
        </p>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--color-base)' }}>
            <span className="text-sm text-text-secondary">Current → Projected</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-text-primary">{result.currentScore}</span>
              <ChevronRight className="w-4 h-4 text-text-tertiary" />
              <span className="text-lg font-bold text-green-400">{result.projectedScore}</span>
              <span className="text-xs text-green-400">(+{result.totalImpact})</span>
            </div>
          </div>
          <p className="text-xs text-text-secondary italic">{result.summary.recommendation}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confidence types & helpers
// ---------------------------------------------------------------------------

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
}

interface Prediction {
  id: string;
  description: string;
  confidence: number;
  outcome: 'correct' | 'incorrect' | 'pending';
  date: string;
  analyzer: string;
}

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


// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ForecastingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Forecasting');

  // Forecasting state
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [evolution, setEvolution] = useState<EvolutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Confidence state
  const [confData, setConfData] = useState<ConfidenceData | null>(null);
  const [confLoading, setConfLoading] = useState(false);
  const [confLoaded, setConfLoaded] = useState(false);
  const [confError, setConfError] = useState<string | null>(null);
  const [confView, setConfView] = useState<'overview' | 'predictions'>('overview');

  // Load forecasting data
  useEffect(() => {
    let cancelled = false;
    Promise.all([getForecast(), getEvolution()])
      .then(([f, e]) => { if (!cancelled) { setForecast(f); setEvolution(e); } })
      .catch(() => { if (!cancelled) setError('Failed to load forecasting data.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Lazy load confidence data
  useEffect(() => {
    if (activeTab !== 'Confidence' || confLoaded) return;
    setConfLoading(true);
    setConfError(null);
    getConfidenceData()
      .then((data) => { setConfData(data); setConfLoaded(true); })
      .catch(() => {
        // A real fetch failure — surface it; zeroed metrics here would render
        // a fabricated "perfect Brier score of 0".
        setConfError('Failed to load confidence data. The analysis server may be unreachable.');
        setConfLoaded(true);
      })
      .finally(() => setConfLoading(false));
  }, [activeTab, confLoaded]);

  // Derived confidence data
  const brierScore = confData?.brierScore ?? 0;
  const calibration: CalibrationBucket[] = confData?.calibration ?? [];
  const analyzers: AnalyzerScore[] = (confData?.analyzerAccuracy ?? []).map(a => ({
    name: a.name, accuracy: a.accuracy, predictions: a.predictions,
    brierScore: a.brierScore,
  }));
  const predictions: Prediction[] = (confData?.recentPredictions ?? []).map(p => ({
    id: p.id, description: p.description, confidence: p.predicted,
    outcome: p.actual === null ? 'pending' as const : p.actual ? 'correct' as const : 'incorrect' as const,
    date: p.date, analyzer: p.source,
  }));
  const totalPredictions = confData?.totalPredictions ?? 0;
  const accuracy = confData?.accuracy ?? 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <Header
          title="Forecasting & Intelligence"
          subtitle="Health trajectory, what-if analysis, evolution tracking, and confidence calibration."
        />
        <LoadingSkeleton variant="card" count={4} />
        <LoadingSkeleton variant="chart" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header
        title="Forecasting & Intelligence"
        subtitle="Health trajectory, what-if analysis, evolution tracking, and confidence calibration."
      />

      {/* Tabs */}
      <div
        className="flex items-center gap-1 border-b border-white/10"
        role="tablist"
        aria-label="Forecasting sections"
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? 'text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Forecasting Tab */}
      {activeTab === 'Forecasting' && (
        <div role="tabpanel" aria-label="Forecasting" className="space-y-6">
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          {/* KPI Row */}
          {forecast && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <p className="text-xs text-text-tertiary uppercase">Current Score</p>
                <p className="text-2xl font-bold text-text-primary">{forecast.currentScore}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <p className="text-xs text-text-tertiary uppercase">Trend</p>
                <div className="flex items-center gap-2">
                  <TrendIcon trend={forecast.trend} />
                  <p className="text-lg font-semibold capitalize text-text-primary">{forecast.trend}</p>
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <p className="text-xs text-text-tertiary uppercase">Model Confidence</p>
                <p className="text-2xl font-bold text-text-primary">{Math.round(forecast.confidence * 100)}%</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <p className="text-xs text-text-tertiary uppercase">Daily Rate</p>
                <p className="text-2xl font-bold" style={{ color: forecast.regression.slope > 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)' }}>
                  {forecast.regression.slope > 0 ? '+' : ''}{forecast.regression.slope}/day
                </p>
              </div>
            </div>
          )}

          {/* Forecast Chart */}
          {forecast && (
            <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                <h3 className="text-lg font-semibold text-text-primary">Health Trajectory Forecast</h3>
              </div>
              <div className="flex items-end gap-0.5 h-32">
                {forecast.history.map((p, i) => (
                  <div
                    key={`h-${i}`}
                    className="flex-1 rounded-t transition-all"
                    style={{
                      height: `${Math.max(4, (p.score / 100) * 128)}px`,
                      background: 'rgba(99, 102, 241, 0.6)',
                      minWidth: '3px',
                    }}
                    title={`${p.date}: ${p.score}`}
                  />
                ))}
                {forecast.forecast.slice(0, 15).map((p, i) => (
                  <div
                    key={`f-${i}`}
                    className="flex-1 rounded-t transition-all"
                    style={{
                      height: `${Math.max(4, (p.predicted / 100) * 128)}px`,
                      background: 'rgba(34, 197, 94, 0.4)',
                      border: '1px dashed rgba(34, 197, 94, 0.6)',
                      minWidth: '3px',
                    }}
                    title={`${p.date}: ${p.predicted} (${p.lowerBound}-${p.upperBound})`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-text-tertiary">
                <span>← Historical</span>
                <span>Forecast →</span>
              </div>

              {/* Targets */}
              <div className="grid grid-cols-4 gap-2 mt-4">
                {forecast.targets.map(t => (
                  <div key={t.target} className="p-2 rounded-lg text-center" style={{ background: 'var(--color-base)' }}>
                    <div className="flex items-center justify-center gap-1">
                      <Target className="w-3 h-3 text-text-tertiary" />
                      <span className="text-xs text-text-tertiary">Score {t.target}</span>
                    </div>
                    <p className="text-sm font-semibold text-text-primary">
                      {t.daysToReach === 0 ? '✅ Reached' :
                       t.daysToReach ? `${t.daysToReach}d` : '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* What-If Analysis */}
          <WhatIfPanel />

          {/* Evolution Timeline */}
          {evolution && (
            <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2 mb-4">
                <GitBranch className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                <h3 className="text-lg font-semibold text-text-primary">Evolution Graph</h3>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Decisions', value: evolution.totalDecisions, color: 'text-blue-400' },
                  { label: 'Milestones', value: evolution.totalMilestones, color: 'text-green-400' },
                  { label: 'Incidents', value: evolution.totalIncidents, color: 'text-red-400' },
                  { label: 'Experiments', value: evolution.totalExperiments, color: 'text-purple-400' },
                ].map(s => (
                  <div key={s.label} className="text-center p-2 rounded-lg" style={{ background: 'var(--color-base)' }}>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-text-tertiary">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {evolution.events.map(event => (
                  <div
                    key={event.id}
                    className="flex gap-4 p-3 rounded-xl transition-all hover:scale-[1.01]"
                    style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
                  >
                    <div className="flex flex-col items-center gap-1 min-w-[80px]">
                      <span className="text-xs text-text-tertiary">{event.date}</span>
                      <EventTypeBadge type={event.type} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-text-primary">{event.title}</h4>
                      <p className="text-xs text-text-secondary mt-0.5">{event.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-xs font-medium ${event.healthImpact >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {event.healthImpact >= 0 ? '+' : ''}{event.healthImpact} health
                        </span>
                        {event.learnings.length > 0 && (
                          <span className="text-xs text-text-tertiary">{event.learnings.length} learning{event.learnings.length > 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confidence Tab */}
      {activeTab === 'Confidence' && (
        <div role="tabpanel" aria-label="Confidence" className="space-y-6">
          {confLoading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-accent)' }} />
            </div>
          )}

          {confError && !confLoading && (
            <ErrorBanner message={confError} onDismiss={() => setConfError(null)} />
          )}

          {confLoaded && !confLoading && !confError && confData && (
            <>
              {totalPredictions === 0 && calibration.length === 0 && analyzers.length === 0 ? (
                <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  <Target className="w-12 h-12 mx-auto text-text-tertiary mb-4" />
                  <h3 className="text-lg font-medium text-text-primary mb-2">No Confidence Data Yet</h3>
                  <p className="text-text-secondary text-sm">Run an analysis to start tracking prediction accuracy and calibration metrics.</p>
                </div>
              ) : (
                <>
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
                      <button key={v} onClick={() => setConfView(v)}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
                        style={{
                          background: confView === v ? 'var(--color-accent)' : 'var(--color-surface)',
                          color: confView === v ? '#fff' : 'var(--color-text-secondary)',
                          border: `1px solid ${confView === v ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        }}>
                        {v}
                      </button>
                    ))}
                  </div>

                  {confView === 'overview' && (
                    <>
                      {/* Calibration Curve Table */}
                      <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                        <div className="flex items-center gap-2 mb-4">
                          <BarChart3 className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                          <h3 className="text-lg font-semibold text-text-primary">Calibration Curve</h3>
                        </div>
                        <div className="overflow-x-auto">
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
                                <p className="text-xs text-text-tertiary">accuracy</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {confView === 'predictions' && (
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
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
