/**
 * @module @recurrsive/server/routes/cloud
 *
 * Self-hosted deployment intelligence routes.
 *
 * Provides:
 * - Anonymized benchmarking (opt-in, aggregated)
 * - Instance-local pattern aggregation
 * - Self-hosted deployment and support information
 *
 * All data is managed via the API — no seed data.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { createRequire } from 'node:module';
import { generateId, nowISO } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';
import { store } from '../store.js';

const require = createRequire(import.meta.url);
const PKG_VERSION: string = (require('../../package.json') as { version: string }).version;

// ---------------------------------------------------------------------------
// Types — Benchmarking
// ---------------------------------------------------------------------------

interface BenchmarkEntry {
  id: string;
  /** Random identifier that is not tied to a user or project record. */
  anonymousSubmissionId: string;
  /** Industry vertical. */
  industry: string;
  /** Team size bracket. */
  teamSize: 'small' | 'medium' | 'large' | 'enterprise';
  /** Health score dimensions. */
  scores: {
    overall: number;
    architecture: number;
    security: number;
    performance: number;
    reliability: number;
    documentation: number;
  };
  /** Analysis metadata. */
  meta: {
    codebaseSize: 'small' | 'medium' | 'large';
    primaryLanguage: string;
    analyzersUsed: number;
    collectorsUsed: number;
  };
  submittedAt: string;
}

interface BenchmarkReport {
  industry: string;
  sampleSize: number;
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  dimensionAverages: Record<string, number>;
  topImprovementAreas: string[];
}

// ---------------------------------------------------------------------------
// Types — Cross-org Learning
// ---------------------------------------------------------------------------

interface LearnedPattern {
  id: string;
  /** Anonymized pattern description. */
  name: string;
  category: string;
  /** How many orgs have seen this. */
  occurrences: number;
  /** Success rate when addressed. */
  successRate: number;
  /** Average health score improvement. */
  avgImpact: number;
  recommendation: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Types — Managed Services
// ---------------------------------------------------------------------------

interface DeploymentService {
  id: string;
  name: string;
  description: string;
  tier: string;
  features: string[];
  priceRange: string;
  availability: string;
}

// ---------------------------------------------------------------------------
// Read-only reference data — managed services catalog (static product info)
// ---------------------------------------------------------------------------

const deploymentServices: DeploymentService[] = [
  { id: 'self-hosted', name: 'Open Source Self-Hosted', description: 'Run the complete Apache-2.0 platform in infrastructure you control.', tier: 'open-source', features: ['Docker and EasyPanel deployment', 'All product capabilities', 'Community support'], priceRange: 'Free', availability: 'Operated by the deploying organization' },
  { id: 'production-support', name: 'Production Support', description: 'Deployment review, operational runbooks, upgrade planning, and named technical guidance.', tier: 'support', features: ['EasyPanel configuration review', 'Backup and restore review', 'Security configuration guidance'], priceRange: 'Custom', availability: 'Response terms are defined by agreement' },
  { id: 'implementation', name: 'Implementation Services', description: 'Hands-on collector, identity, policy, and workflow integration.', tier: 'services', features: ['Custom integrations', 'Data migration planning', 'Acceptance criteria and handoff'], priceRange: 'Custom', availability: 'Scoped per engagement' },
];

// No seed data — benchmarks and patterns are created via API or analysis.

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerCloudRoutes(app: FastifyInstance): Promise<void> {
  // ── Benchmarking ──────────────────────────────────────────────────────────

  // Submit benchmark data (opt-in)
  app.post('/api/v1/cloud/benchmarks', {
    preHandler: [authMiddleware],
    schema: {
      body: {
        type: 'object',
        required: ['industry', 'teamSize', 'scores', 'meta'],
        properties: {
          industry: { type: 'string', minLength: 1 },
          teamSize: { type: 'string', enum: ['small', 'medium', 'large', 'enterprise'] },
          scores: {
            type: 'object',
            required: ['overall', 'architecture', 'security', 'performance', 'reliability', 'documentation'],
            properties: {
              overall: { type: 'number' },
              architecture: { type: 'number' },
              security: { type: 'number' },
              performance: { type: 'number' },
              reliability: { type: 'number' },
              documentation: { type: 'number' },
            },
          },
          meta: {
            type: 'object',
            required: ['codebaseSize', 'primaryLanguage', 'analyzersUsed', 'collectorsUsed'],
            properties: {
              codebaseSize: { type: 'string', enum: ['small', 'medium', 'large'] },
              primaryLanguage: { type: 'string' },
              analyzersUsed: { type: 'integer' },
              collectorsUsed: { type: 'integer' },
            },
          },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const body = request.body as Omit<BenchmarkEntry, 'id' | 'anonymousSubmissionId' | 'submittedAt'>;

    const entry: BenchmarkEntry = {
      id: generateId(),
      anonymousSubmissionId: `anon-${generateId().slice(0, 8)}`,
      industry: body.industry,
      teamSize: body.teamSize,
      scores: body.scores,
      meta: body.meta,
      submittedAt: nowISO(),
    };
    await store.set<BenchmarkEntry>('cloud_benchmarks', entry.id, entry);
    return reply.status(201).send({ data: { id: entry.id, message: 'Benchmark submitted (anonymized)' } });
  });

  // Get benchmark report
  app.get<{ Querystring: { industry?: string } }>('/api/v1/cloud/benchmarks/report', { preHandler: [authMiddleware] }, async (request, reply) => {
    const industry = request.query.industry;
    const allBenchmarks = await store.all<BenchmarkEntry>('cloud_benchmarks');
    const entries = industry ? allBenchmarks.filter(b => b.industry === industry) : allBenchmarks;

    if (entries.length === 0) {
      return reply.send({ data: { message: 'No benchmark data available', sampleSize: 0 } });
    }

    const scores = entries.map(e => e.scores.overall).sort((a, b) => a - b);
    const p = (pct: number) => scores[Math.floor(scores.length * pct)] ?? 0;

    const dims = ['architecture', 'security', 'performance', 'reliability', 'documentation'];
    const dimAvgs: Record<string, number> = {};
    for (const dim of dims) {
      const vals = entries.map(e => (e.scores as Record<string, number>)[dim] ?? 0);
      dimAvgs[dim] = Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
    }

    // Find weakest dimensions
    const sorted = Object.entries(dimAvgs).sort(([, a], [, b]) => a - b);
    const report: BenchmarkReport = {
      industry: industry ?? 'all',
      sampleSize: entries.length,
      percentiles: { p25: Math.round(p(0.25) * 10) / 10, p50: Math.round(p(0.5) * 10) / 10, p75: Math.round(p(0.75) * 10) / 10, p90: Math.round(p(0.9) * 10) / 10 },
      dimensionAverages: dimAvgs,
      topImprovementAreas: sorted.slice(0, 3).map(([dim]) => dim),
    };

    return reply.send({ data: report });
  });

  // ── Cross-org Pattern Learning ────────────────────────────────────────────

  app.get('/api/v1/cloud/patterns', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const patterns = await store.all<LearnedPattern>('cloud_patterns');
    return reply.send({
      data: patterns.sort((a, b) => b.occurrences - a.occurrences),
      total: patterns.length,
      privacyNote: 'Patterns are derived only from data submitted to this self-hosted instance.',
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/cloud/patterns/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const pattern = await store.get<LearnedPattern>('cloud_patterns', request.params.id);
    if (!pattern) return reply.status(404).send({ error: 'Not Found', message: 'Pattern not found' });
    return reply.send({ data: pattern });
  });

  // ── Managed Services ──────────────────────────────────────────────────────

  app.get('/api/v1/cloud/services', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.send({ data: deploymentServices, total: deploymentServices.length });
  });

  // ── Cloud Platform Info ───────────────────────────────────────────────────

  app.get('/api/v1/cloud/info', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const benchmarkCount = await store.count('cloud_benchmarks');
    return reply.send({
      data: {
        platform: 'Recurrsive Self-Hosted',
        version: PKG_VERSION,
        status: 'self-hosted',
        regions: [],
        features: {
          benchmarking: { status: 'active', participants: benchmarkCount },
          patternLearning: { status: 'instance-local', patterns: await store.count('cloud_patterns') },
          deploymentServices: { status: 'available', offerings: deploymentServices.length },
        },
        managedCloud: false,
      },
    });
  });

}
