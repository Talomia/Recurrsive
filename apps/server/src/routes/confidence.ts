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
// In-memory store
// ---------------------------------------------------------------------------

const predictions: Map<string, Prediction> = new Map();

// Seed demo predictions
const analyzers = ['architecture', 'security', 'performance', 'reliability', 'ai', 'cost', 'dependency', 'ux'];
const now = Date.now();

for (let i = 0; i < 100; i++) {
  const id = generateId();
  const analyzerId = analyzers[i % analyzers.length]!;
  const predicted = Math.round((0.3 + Math.random() * 0.6) * 100) / 100;
  // Simulate ~70% accuracy with calibration drift
  const actualOccurred = Math.random() < predicted + (Math.random() - 0.5) * 0.3;
  const daysAgo = Math.floor(Math.random() * 90);

  predictions.set(id, {
    id,
    analyzerId,
    findingId: generateId(),
    description: `${analyzerId} finding #${i + 1}`,
    predictedProbability: predicted,
    actualOutcome: daysAgo > 7 ? actualOccurred : null,
    severity: (['critical', 'high', 'medium', 'low'] as const)[i % 4]!,
    predictedAt: new Date(now - daysAgo * 86400000).toISOString(),
    resolvedAt: daysAgo > 7 ? new Date(now - (daysAgo - 5) * 86400000).toISOString() : null,
  });
}

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
    const all = Array.from(predictions.values());
    const resolved = all.filter(p => p.actualOutcome !== null);

    // Per-analyzer Brier scores
    const analyzerScores = analyzers.map(aid => {
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
    const prediction = predictions.get(request.params.id);
    if (!prediction) return reply.status(404).send({ error: 'Not Found', message: 'Prediction not found' });

    const body = request.body as { occurred: boolean };
    if (typeof body.occurred !== 'boolean') {
      return reply.status(400).send({ error: 'Bad Request', message: 'occurred (boolean) is required' });
    }

    prediction.actualOutcome = body.occurred;
    prediction.resolvedAt = nowISO();

    return reply.send({ data: prediction });
  });

  // List predictions with filtering
  app.get<{ Querystring: { analyzer?: string; status?: string; severity?: string } }>(
    '/api/v1/confidence/predictions',
    async (request, reply) => {
      let preds = Array.from(predictions.values());

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
      const preds = Array.from(predictions.values()).filter(p => p.analyzerId === request.params.analyzerId);
      if (preds.length === 0) {
        return reply.status(404).send({ error: `No predictions for analyzer: ${request.params.analyzerId}` });
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
}
