/**
 * @module @recurrsive/server/routes/cloud
 *
 * Recurrsive Cloud (SaaS) routes.
 *
 * Provides:
 * - Anonymized benchmarking (opt-in, aggregated)
 * - Cross-organization pattern learning (privacy-preserved)
 * - Managed optimization services
 * - Recurrsive Cloud (fully managed SaaS) management
 *
 * All data is managed via the API — no seed data.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { createRequire } from 'node:module';
import { generateId, nowISO } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { store } from '../store.js';

const require = createRequire(import.meta.url);
const PKG_VERSION: string = (require('../../package.json') as { version: string }).version;

// ---------------------------------------------------------------------------
// Types — Benchmarking
// ---------------------------------------------------------------------------

interface BenchmarkEntry {
  id: string;
  /** Anonymized tenant identifier. */
  anonymizedTenantId: string;
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

interface ManagedService {
  id: string;
  name: string;
  description: string;
  tier: string;
  features: string[];
  priceRange: string;
  sla: string;
}

// ---------------------------------------------------------------------------
// Read-only reference data — managed services catalog (static product info)
// ---------------------------------------------------------------------------

const managedServices: ManagedService[] = [
  { id: 'ms-starter', name: 'Recurrsive Cloud Starter', description: 'Fully managed Recurrsive instance with automated analysis, dashboard, and email reports.', tier: 'starter', features: ['Hosted dashboard', 'Daily analysis runs', 'Email reports', '5 projects', '3 users'], priceRange: '$99/mo', sla: '99.5% uptime' },
  { id: 'ms-professional', name: 'Recurrsive Cloud Professional', description: 'Professional tier with advanced features, priority support, and custom integrations.', tier: 'professional', features: ['Everything in Starter', 'Real-time analysis', 'Webhook integrations', '20 projects', '25 users', 'SSO', 'Priority support'], priceRange: '$499/mo', sla: '99.9% uptime' },
  { id: 'ms-enterprise', name: 'Recurrsive Cloud Enterprise', description: 'Enterprise-grade deployment with dedicated infrastructure, SLAs, and managed optimization.', tier: 'enterprise', features: ['Everything in Professional', 'Dedicated infrastructure', 'Custom domains', 'Unlimited projects', 'Unlimited users', 'Managed optimization', '24/7 support', 'Custom SLA'], priceRange: 'Custom', sla: '99.99% uptime' },
  { id: 'ms-oaas', name: 'Optimization-as-a-Service', description: 'Our expert team reviews your findings and implements improvements on your behalf.', tier: 'addon', features: ['Monthly review sessions', 'PR generation', 'Architecture recommendations', 'Dedicated success engineer'], priceRange: '$2,000/mo', sla: 'Included with Enterprise' },
];

// No seed data — benchmarks and patterns are created via API or analysis.

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerCloudRoutes(app: FastifyInstance): Promise<void> {
  // ── Benchmarking ──────────────────────────────────────────────────────────

  // Submit benchmark data (opt-in)
  app.post('/api/v1/cloud/benchmarks', {
    preHandler: [authMiddleware, requireRole('analyst')],
    schema: {
      body: {
        type: 'object',
        required: ['industry'],
        properties: {
          industry: { type: 'string', minLength: 1 },
          teamSize: { type: 'string', enum: ['small', 'medium', 'large', 'enterprise'] },
          scores: {
            type: 'object',
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
    const body = request.body as Partial<BenchmarkEntry>;
    if (!body.industry) return reply.status(400).send({ error: 'Bad Request', message: 'industry is required' });

    const entry: BenchmarkEntry = {
      id: generateId(),
      anonymizedTenantId: `anon-${generateId().slice(0, 8)}`,
      industry: body.industry,
      teamSize: body.teamSize ?? 'medium',
      scores: body.scores ?? { overall: 50, architecture: 50, security: 50, performance: 50, reliability: 50, documentation: 50 },
      meta: body.meta ?? { codebaseSize: 'medium', primaryLanguage: 'TypeScript', analyzersUsed: 8, collectorsUsed: 5 },
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
      privacyNote: 'All patterns are aggregated from anonymized data. No individual organization data is shared.',
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/cloud/patterns/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const pattern = await store.get<LearnedPattern>('cloud_patterns', request.params.id);
    if (!pattern) return reply.status(404).send({ error: 'Not Found', message: 'Pattern not found' });
    return reply.send({ data: pattern });
  });

  // ── Managed Services ──────────────────────────────────────────────────────

  app.get('/api/v1/cloud/services', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.send({ data: managedServices, total: managedServices.length });
  });

  // ── Cloud Platform Info ───────────────────────────────────────────────────

  app.get('/api/v1/cloud/info', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const benchmarkCount = await store.count('cloud_benchmarks');
    return reply.send({
      data: {
        platform: 'Recurrsive Cloud',
        version: PKG_VERSION,
        status: 'preview',
        regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
        features: {
          benchmarking: { status: 'active', participants: benchmarkCount },
          patternLearning: { status: 'active', patterns: await store.count('cloud_patterns') },
          managedServices: { status: 'active', tiers: managedServices.length },
          partnerProgram: { status: 'active', note: 'See /api/v1/partners for partner data' },
        },
        upcomingFeatures: [
          'Multi-region failover',
          'Compliance dashboards',
          'Automated remediation workflows',
          'Custom model fine-tuning',
        ],
      },
    });
  });

  // ── Partners ──────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/cloud/partners
   *
   * Return cloud technology partners.
   * Note: The primary partner data is at /api/v1/partners.
   * This endpoint returns a cloud-specific view of partner integrations.
   */
  app.get('/api/v1/cloud/partners', { preHandler: [authMiddleware] }, async (_request, reply) => {
    // Cloud partners are a subset of ecosystem partnerships relevant to cloud services
    const cloudPartners = [
      {
        id: 'cp-aws',
        name: 'Amazon Web Services',
        type: 'cloud_provider',
        status: 'active',
        integration_level: 'full',
        supported_services: ['ECS', 'Lambda', 'S3', 'CloudWatch'],
      },
      {
        id: 'cp-gcp',
        name: 'Google Cloud Platform',
        type: 'cloud_provider',
        status: 'active',
        integration_level: 'full',
        supported_services: ['Cloud Run', 'Cloud Functions', 'GCS', 'Cloud Monitoring'],
      },
      {
        id: 'cp-azure',
        name: 'Microsoft Azure',
        type: 'cloud_provider',
        status: 'active',
        integration_level: 'partial',
        supported_services: ['Container Apps', 'Functions', 'Blob Storage'],
      },
      {
        id: 'cp-datadog',
        name: 'Datadog',
        type: 'monitoring',
        status: 'active',
        integration_level: 'webhook',
        supported_services: ['APM', 'Logging', 'Metrics'],
      },
    ];

    return reply.send({ data: cloudPartners });
  });
}
