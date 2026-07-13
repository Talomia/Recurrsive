'use client';

/** Transparent health projection from persisted analysis history. */

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Brain, GitBranch, Minus, Target, TrendingUp } from 'lucide-react';
import { getEvolution, getForecast, type EvolutionData, type ForecastData } from '@/lib/api';
import ErrorBanner from '@/components/error-banner';

function TrendIcon({ trend }: { trend: ForecastData['trend'] }) {
  if (trend === 'improving') return <ArrowUp className="h-4 w-4 text-green-400" />;
  if (trend === 'declining') return <ArrowDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-yellow-400" />;
}

export default function ForecastingPage() {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [evolution, setEvolution] = useState<EvolutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getForecast(), getEvolution()])
      .then(([nextForecast, nextEvolution]) => {
        if (active) {
          setForecast(nextForecast);
          setEvolution(nextEvolution);
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Failed to load health projection.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-accent-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-text-primary">
          <Brain className="h-6 w-6 text-accent-blue" />
          Health Projection
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Linear projection and recorded health changes from persisted analysis history.
        </p>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {forecast && !forecast.available && (
        <div className="rounded-xl border border-border bg-surface p-4 text-sm text-text-secondary">
          Run at least {forecast.requiredHistoryPoints} successful analyses before a projection is shown.
        </div>
      )}

      {forecast && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs uppercase text-text-tertiary">Current score</p>
              <p className="text-2xl font-bold text-text-primary">{forecast.currentScore}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs uppercase text-text-tertiary">Trend</p>
              <div className="flex items-center gap-2">
                <TrendIcon trend={forecast.trend} />
                <p className="text-lg font-semibold capitalize text-text-primary">{forecast.trend}</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs uppercase text-text-tertiary">Observed-data fit (R²)</p>
              <p className="text-2xl font-bold text-text-primary">{Math.round(forecast.regression.r2 * 100)}%</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-xs uppercase text-text-tertiary">Fitted daily slope</p>
              <p className="text-2xl font-bold text-text-primary">{forecast.regression.slope.toFixed(2)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-accent-blue" />
              <h2 className="text-lg font-semibold text-text-primary">Recorded Health and Linear Projection</h2>
            </div>
            <div className="flex h-32 items-end gap-0.5">
              {forecast.history.map((point, index) => (
                <div
                  key={`history-${point.date}-${index}`}
                  className="min-w-[3px] flex-1 rounded-t bg-indigo-500/60"
                  style={{ height: `${Math.max(4, point.score * 1.28)}px` }}
                  title={`${point.date}: ${point.score}`}
                />
              ))}
              {forecast.forecast.slice(0, 15).map((point) => (
                <div
                  key={`projection-${point.date}`}
                  className="min-w-[3px] flex-1 rounded-t border border-dashed border-green-500/60 bg-green-500/40"
                  style={{ height: `${Math.max(4, point.predicted * 1.28)}px` }}
                  title={`${point.date}: ${point.predicted} (${point.lowerBound}-${point.upperBound})`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-text-tertiary">
              <span>Recorded history</span><span>Projection</span>
            </div>
            {forecast.available && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {forecast.targets.map((target) => (
                  <div key={target.target} className="rounded-lg bg-base p-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-xs text-text-tertiary">
                      <Target className="h-3 w-3" /> Score {target.target}
                    </div>
                    <p className="text-sm font-semibold text-text-primary">
                      {target.daysToReach === 0 ? 'Reached' : target.reachable ? `${target.daysToReach}d` : 'Not projected'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {evolution && (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="mb-4 flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-accent-blue" />
            <h2 className="text-lg font-semibold text-text-primary">Recorded Analysis Evolution</h2>
          </div>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-base p-2 text-center"><p className="text-xl font-bold text-blue-400">{evolution.totalAnalyses}</p><p className="text-xs text-text-tertiary">Analyses</p></div>
            <div className="rounded-lg bg-base p-2 text-center"><p className="text-xl font-bold text-text-primary">{evolution.currentScore}</p><p className="text-xs text-text-tertiary">Current health</p></div>
            <div className="rounded-lg bg-base p-2 text-center"><p className="text-xl font-bold text-text-primary">{evolution.netHealthChange}</p><p className="text-xs text-text-tertiary">Net change</p></div>
          </div>
          <div className="space-y-3">
            {evolution.events.map((event) => (
              <div key={event.id} className="rounded-xl border border-border bg-base p-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-text-primary">{event.title}</h3>
                  <span className="text-xs text-text-tertiary">{event.date}</span>
                </div>
                <p className="mt-1 text-xs text-text-secondary">{event.description}</p>
                <p className="mt-2 text-xs text-text-tertiary">Recorded health change: {event.healthImpact >= 0 ? '+' : ''}{event.healthImpact}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
