'use client';

/**
 * Forecasting & Intelligence page.
 *
 * Health trajectory prediction, what-if analysis, and evolution graph.
 */

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Zap, GitBranch, ChevronRight, ArrowUp, ArrowDown, Minus, Target, Brain } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ForecastData {
  currentScore: number;
  trend: 'improving' | 'declining' | 'stable';
  trendStrength: number;
  confidence: number;
  history: Array<{ date: string; score: number }>;
  forecast: Array<{ date: string; predicted: number; lowerBound: number; upperBound: number }>;
  targets: Array<{ target: number; daysToReach: number | null; reachable: boolean }>;
  regression: { slope: number; intercept: number; r2: number };
}

interface EvolutionEvent {
  id: string;
  date: string;
  type: 'decision' | 'milestone' | 'incident' | 'experiment';
  title: string;
  description: string;
  outcome: string;
  healthImpact: number;
  learnings: string[];
}

interface EvolutionData {
  events: EvolutionEvent[];
  trajectory: Array<{ date: string; score: number; event: string }>;
  currentScore: number;
  totalDecisions: number;
  totalMilestones: number;
  totalIncidents: number;
  totalExperiments: number;
  netHealthImpact: number;
  allLearnings: string[];
}

interface WhatIfResult {
  currentScore: number;
  projectedScore: number;
  totalImpact: number;
  actions: Array<{
    id: string;
    type: string;
    description: string;
    impact: {
      healthScoreDelta: number;
      confidence: number;
      timeToRealize: string;
      affectedDimensions: string[];
    };
  }>;
  summary: {
    highestImpact: string | null;
    totalActions: number;
    avgConfidence: number;
    recommendation: string;
  };
}

// ─── Components ──────────────────────────────────────────────────────────────

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

// ─── What-If Panel ───────────────────────────────────────────────────────────

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

  const simulate = useCallback(async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      const actions = Array.from(selected).map(type => ({
        type,
        description: ACTION_TYPES.find(a => a.type === type)?.label ?? type,
      }));
      const res = await fetch('/api/v1/forecasting/what-if', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions }),
      });
      if (res.ok) setResult((await res.json()).data);
    } catch { /* ignore */ }
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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ForecastingPage() {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [evolution, setEvolution] = useState<EvolutionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/forecasting/health').then(r => r.json()),
      fetch('/api/v1/forecasting/evolution').then(r => r.json()),
    ])
      .then(([f, e]) => { setForecast(f.data); setEvolution(e.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-accent)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Brain className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
          Forecasting & Intelligence
        </h1>
        <p className="text-sm text-text-secondary mt-1">Health trajectory, what-if analysis, and evolution tracking.</p>
      </div>

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

          {/* Stats row */}
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

          {/* Timeline */}
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
  );
}
