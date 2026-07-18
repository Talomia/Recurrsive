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
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

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
  app.get('/api/v1/confidence/overview', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const all = await store.all<Prediction>('predictions');
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
  app.post<{ Params: { id: string } }>('/api/v1/confidence/predictions/:id/outcome', {
    preHandler: [authMiddleware, requireRole('analyst')],
    schema: {
      body: {
        type: 'object',
        required: ['occurred'],
        properties: {
          occurred: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const prediction = await store.get<Prediction>('predictions', request.params.id);
    if (!prediction) return reply.status(404).send({ error: 'Not Found', message: 'Prediction not found' });

    const body = request.body as { occurred: boolean };
    if (typeof body.occurred !== 'boolean') {
      return reply.status(400).send({ error: 'Bad Request', message: 'occurred (boolean) is required' });
    }

    prediction.actualOutcome = body.occurred;
    prediction.resolvedAt = nowISO();
    await store.set<Prediction>('predictions', prediction.id, prediction);

    return reply.send({ data: prediction });
  });

  // List predictions with filtering
  app.get<{ Querystring: { analyzer?: string; status?: string; severity?: string } }>(
    '/api/v1/confidence/predictions',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      let preds = await store.all<Prediction>('predictions');

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
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const preds = (await store.all<Prediction>('predictions')).filter(p => p.analyzerId === request.params.analyzerId);
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
  app.post('/api/v1/confidence/predictions', {
    preHandler: [authMiddleware, requireRole('analyst')],
    schema: {
      body: {
        type: 'object',
        required: ['findingId', 'analyzer', 'predictedSeverity', 'predictedCategory', 'confidence'],
        properties: {
          findingId: { type: 'string', minLength: 1 },
          analyzer: { type: 'string', minLength: 1 },
          predictedSeverity: { type: 'string', minLength: 1 },
          predictedCategory: { type: 'string', minLength: 1 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
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

    await store.set<Prediction>('predictions', id, prediction);
    return reply.status(201).send({ data: prediction });
  });

  // Generate predictions from the requested project's analysis findings
  app.post<{ Querystring: { projectId?: string } }>('/api/v1/confidence/predictions/generate', { preHandler: [authMiddleware, requireRole('analyst')] }, async (request, reply) => {
    const cache = state.isInitialized() ? await state.loadCacheForProject(request.query.projectId) : null;
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
      await store.set<Prediction>('predictions', id, prediction);
      count++;
    }

    return reply.status(200).send({
      data: { predictionsCreated: count },
      message: `Generated ${count} predictions from analysis findings`,
    });
  });

  /**
   * GET /api/v1/confidence/factors
   *
   * Return confidence scoring factors derived from prediction data.
   * Factors include per-severity accuracy, per-analyzer calibration,
   * and data volume considerations.
   */
  app.get('/api/v1/confidence/factors', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const all = await store.all<Prediction>('predictions');
    const resolved = all.filter(p => p.actualOutcome !== null);

    // Per-severity accuracy factor
    const severities = ['critical', 'high', 'medium', 'low'] as const;
    const severityFactors = severities.map(sev => {
      const preds = resolved.filter(p => p.severity === sev);
      const accurate = preds.filter(p =>
        (p.predictedProbability >= 0.5 && p.actualOutcome) ||
        (p.predictedProbability < 0.5 && !p.actualOutcome),
      );
      return {
        name: `severity_${sev}`,
        type: 'accuracy',
        value: preds.length > 0 ? Math.round((accurate.length / preds.length) * 1000) / 1000 : 0,
        sample_size: preds.length,
        description: `Prediction accuracy for ${sev}-severity findings`,
      };
    });

    // Per-analyzer calibration factor
    const analyzerIds = [...new Set(all.map(p => p.analyzerId))];
    const analyzerFactors = analyzerIds.map(aid => {
      const preds = all.filter(p => p.analyzerId === aid);
      return {
        name: `analyzer_${aid}`,
        type: 'calibration',
        value: brierScore(preds),
        sample_size: preds.length,
        description: `Brier score for analyzer ${aid} (lower = better)`,
      };
    });

    // Data volume factor
    const dataVolumeFactor = {
      name: 'data_volume',
      type: 'coverage',
      value: Math.min(1, all.length / 100),
      sample_size: all.length,
      description: 'Confidence based on prediction data volume (1.0 = 100+ predictions)',
    };

    // Resolution rate factor
    const resolutionFactor = {
      name: 'resolution_rate',
      type: 'coverage',
      value: all.length > 0 ? Math.round((resolved.length / all.length) * 1000) / 1000 : 0,
      sample_size: all.length,
      description: 'Fraction of predictions that have been resolved with outcomes',
    };

    const factors = [...severityFactors, ...analyzerFactors, dataVolumeFactor, resolutionFactor];

    // Overall confidence: weighted average of non-zero accuracy factors + data volume
    const accuracyFactors = severityFactors.filter(f => f.sample_size > 0);
    const avgAccuracy = accuracyFactors.length > 0
      ? accuracyFactors.reduce((s, f) => s + f.value, 0) / accuracyFactors.length
      : 0;
    const overall_confidence = Math.round(
      ((avgAccuracy * 0.6) + (dataVolumeFactor.value * 0.2) + (resolutionFactor.value * 0.2)) * 1000,
    ) / 1000;

    return reply.send({
      data: {
        factors,
        overall_confidence,
      },
    });
  });
}
