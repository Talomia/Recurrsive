/**
 * @module @recurrsive/server/routes/confidence
 *
 * Confidence calibration routes.
 *
 * Tracks prediction accuracy over time to calibrate the reliability
 * of analyzer findings and recommendations. Records outcomes for
 * past predictions and computes Brier scores per analyzer.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';
import { store } from '../store.js';
import { state } from '../state.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Prediction {
  id: string;
  /** Which analyzer made the prediction. */
  analyzerId: string;
  /** The finding or recommendation ID. */
  findingId: string;
  /** Description of what was predicted. */
  description: string;
  /** Predicted probability (0-1). */
  predictedProbability: number;
  /** Actual outcome: null = pending, true = occurred, false = did not occur. */
  actualOutcome: boolean | null;
  /** Severity of the predicted issue. */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** When the prediction was made. */
  predictedAt: string;
  /** When the outcome was recorded. */
  resolvedAt: string | null;
}

interface CalibrationBucket {
  /** Predicted probability range. */
  range: string;
  /** Number of predictions in this bucket. */
  count: number;
  /** Average predicted probability. */
  avgPredicted: number;
  /** Actual outcome rate. */
  actualRate: number;
  /** Calibration error (|predicted - actual|). */
  calibrationError: number;
}

// ---------------------------------------------------------------------------
// No seed data — predictions are populated from real analysis runs.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute Brier score (lower = better calibration, 0 = perfect). */
function brierScore(preds: Prediction[]): number {
  const resolved = preds.filter(p => p.actualOutcome !== null);
  if (resolved.length === 0) return 0;
  const sum = resolved.reduce((s, p) => {
    const outcome = p.actualOutcome ? 1 : 0;
    return s + (p.predictedProbability - outcome) ** 2;
  }, 0);
  return Math.round((sum / resolved.length) * 1000) / 1000;
}

/** Build calibration curve buckets. */
function calibrationCurve(preds: Prediction[]): CalibrationBucket[] {
  const resolved = preds.filter(p => p.actualOutcome !== null);
  const buckets: CalibrationBucket[] = [];
  const ranges = [
    { min: 0, max: 0.2, label: '0-20%' },
    { min: 0.2, max: 0.4, label: '20-40%' },
    { min: 0.4, max: 0.6, label: '40-60%' },
    { min: 0.6, max: 0.8, label: '60-80%' },
    { min: 0.8, max: 1.01, label: '80-100%' },
  ];

  for (const range of ranges) {
    const bucket = resolved.filter(p => p.predictedProbability >= range.min && p.predictedProbability < range.max);
    if (bucket.length === 0) {
      buckets.push({ range: range.label, count: 0, avgPredicted: 0, actualRate: 0, calibrationError: 0 });
      continue;
    }
    const avgPredicted = bucket.reduce((s, p) => s + p.predictedProbability, 0) / bucket.length;
    const actualRate = bucket.filter(p => p.actualOutcome === true).length / bucket.length;
    buckets.push({
      range: range.label,
      count: bucket.length,
      avgPredicted: Math.round(avgPredicted * 1000) / 1000,
      actualRate: Math.round(actualRate * 1000) / 1000,
      calibrationError: Math.round(Math.abs(avgPredicted - actualRate) * 1000) / 1000,
    });
  }

  return buckets;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerConfidenceRoutes(app: FastifyInstance): Promise<void> {
  // Overall calibration metrics
  app.get('/api/v1/confidence/overview', async (_request, reply) => {
    const all = store.all<Prediction>('predictions');
    const resolved = all.filter(p => p.actualOutcome !== null);

    // Per-analyzer Brier scores — derive analyzer IDs from actual predictions
    const analyzerIds = [...new Set(all.map(p => p.analyzerId))];
    const analyzerScores = analyzerIds.map(aid => {
      const preds = all.filter(p => p.analyzerId === aid);
      return {
        analyzerId: aid,
        totalPredictions: preds.length,
        resolved: preds.filter(p => p.actualOutcome !== null).length,
        pending: preds.filter(p => p.actualOutcome === null).length,
        brierScore: brierScore(preds),
        accuracy: Math.round(
          (preds.filter(p => p.actualOutcome !== null && (
            (p.predictedProbability >= 0.5 && p.actualOutcome) ||
            (p.predictedProbability < 0.5 && !p.actualOutcome)
          )).length / Math.max(1, preds.filter(p => p.actualOutcome !== null).length)) * 1000,
        ) / 10,
      };
    });

    return reply.send({
      data: {
        totalPredictions: all.length,
        resolved: resolved.length,
        pending: all.length - resolved.length,
        overallBrierScore: brierScore(all),
        overallAccuracy: Math.round(
          (resolved.filter(p =>
            (p.predictedProbability >= 0.5 && p.actualOutcome) ||
            (p.predictedProbability < 0.5 && !p.actualOutcome),
          ).length / Math.max(1, resolved.length)) * 1000,
        ) / 10,
        calibrationCurve: calibrationCurve(all),
        analyzerScores: analyzerScores.sort((a, b) => a.brierScore - b.brierScore),
        bestCalibrated: analyzerScores.sort((a, b) => a.brierScore - b.brierScore)[0]?.analyzerId ?? null,
        worstCalibrated: analyzerScores.sort((a, b) => b.brierScore - a.brierScore)[0]?.analyzerId ?? null,
      },
      generatedAt: nowISO(),
    });
  });

  // Record outcome for a prediction
  app.post<{ Params: { id: string } }>('/api/v1/confidence/predictions/:id/outcome', async (request, reply) => {
    const prediction = store.get<Prediction>('predictions', request.params.id);
    if (!prediction) return reply.status(404).send({ error: 'Not Found', message: 'Prediction not found' });

    const body = request.body as { occurred: boolean };
    if (typeof body.occurred !== 'boolean') {
      return reply.status(400).send({ error: 'Bad Request', message: 'occurred (boolean) is required' });
    }

    prediction.actualOutcome = body.occurred;
    prediction.resolvedAt = nowISO();
    store.set<Prediction>('predictions', prediction.id, prediction);

    return reply.send({ data: prediction });
  });

  // List predictions with filtering
  app.get<{ Querystring: { analyzer?: string; status?: string; severity?: string } }>(
    '/api/v1/confidence/predictions',
    async (request, reply) => {
      let preds = store.all<Prediction>('predictions');

      if (request.query.analyzer) {
        preds = preds.filter(p => p.analyzerId === request.query.analyzer);
      }
      if (request.query.status === 'pending') {
        preds = preds.filter(p => p.actualOutcome === null);
      } else if (request.query.status === 'resolved') {
        preds = preds.filter(p => p.actualOutcome !== null);
      }
      if (request.query.severity) {
        preds = preds.filter(p => p.severity === request.query.severity);
      }

      return reply.send({
        data: preds.sort((a, b) => b.predictedAt.localeCompare(a.predictedAt)).slice(0, 50),
        total: preds.length,
      });
    },
  );

  // Get calibration curve for specific analyzer
  app.get<{ Params: { analyzerId: string } }>(
    '/api/v1/confidence/calibration/:analyzerId',
    async (request, reply) => {
      const preds = store.all<Prediction>('predictions').filter(p => p.analyzerId === request.params.analyzerId);
      if (preds.length === 0) {
        return reply.status(404).send({ error: 'Not Found', message: `No predictions for analyzer: ${request.params.analyzerId}` });
      }

      return reply.send({
        data: {
          analyzerId: request.params.analyzerId,
          totalPredictions: preds.length,
          brierScore: brierScore(preds),
          calibrationCurve: calibrationCurve(preds),
        },
      });
    },
  );

  // Create a single prediction
  app.post('/api/v1/confidence/predictions', async (request, reply) => {
    const body = request.body as {
      findingId?: string;
      analyzer?: string;
      predictedSeverity?: string;
      predictedCategory?: string;
      confidence?: number;
    };

    if (!body.findingId || !body.analyzer || !body.predictedSeverity || !body.predictedCategory || body.confidence === undefined) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'findingId, analyzer, predictedSeverity, predictedCategory, and confidence are required',
      });
    }

    const id = generateId();
    const prediction: Prediction = {
      id,
      analyzerId: body.analyzer,
      findingId: body.findingId,
      description: `Predicted ${body.predictedSeverity} ${body.predictedCategory} finding`,
      predictedProbability: body.confidence,
      actualOutcome: null,
      severity: body.predictedSeverity as Prediction['severity'],
      predictedAt: nowISO(),
      resolvedAt: null,
    };

    store.set<Prediction>('predictions', id, prediction);
    return reply.status(201).send({ data: prediction });
  });

  // Generate predictions from current analysis findings
  app.post('/api/v1/confidence/predictions/generate', async (_request, reply) => {
    const cache = state.isInitialized() ? state.getAnalysisCache() : null;
    const findings = cache?.findings ?? [];

    let count = 0;
    for (const finding of findings) {
      const id = generateId();
      const prediction: Prediction = {
        id,
        analyzerId: finding.analyzer_id,
        findingId: finding.id,
        description: `Predicted ${finding.severity} ${finding.category} finding`,
        predictedProbability: finding.confidence,
        actualOutcome: null,
        severity: finding.severity as Prediction['severity'],
        predictedAt: nowISO(),
        resolvedAt: null,
      };
      store.set<Prediction>('predictions', id, prediction);
      count++;
    }

    return reply.status(200).send({
      data: { predictionsCreated: count },
      message: `Generated ${count} predictions from analysis findings`,
    });
  });
}
