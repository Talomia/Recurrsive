/**
 * @module @recurrsive/server/routes/cloud
 *
 * Recurrsive Cloud (SaaS) routes.
 *
 * Provides:
 * - Anonymized benchmarking (opt-in, aggregated)
 * - Cross-organization pattern learning (privacy-preserved)
 * - Managed optimization services
 * - Partner certification program
 * - Recurrsive Cloud (fully managed SaaS) management
 *
 * All data is managed via the API — no seed data.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';
import { store } from '../store.js';

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
// Types — Partner Certification
// ---------------------------------------------------------------------------

interface PartnerCert {
  id: string;
  partnerName: string;
  tier: 'silver' | 'gold' | 'platinum';
  specializations: string[];
  certifiedAt: string;
  expiresAt: string;
  status: 'active' | 'pending' | 'expired';
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

// No seed data — benchmarks, patterns, and partner data are created via API or analysis.

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerCloudRoutes(app: FastifyInstance): Promise<void> {
  // ── Benchmarking ──────────────────────────────────────────────────────────

  // Submit benchmark data (opt-in)
  app.post('/api/v1/cloud/benchmarks', { preHandler: [authMiddleware] }, async (request, reply) => {
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
    store.set<BenchmarkEntry>('cloud_benchmarks', entry.id, entry);
    return reply.status(201).send({ data: { id: entry.id, message: 'Benchmark submitted (anonymized)' } });
  });

  // Get benchmark report
  app.get<{ Querystring: { industry?: string } }>('/api/v1/cloud/benchmarks/report', { preHandler: [authMiddleware] }, async (request, reply) => {
    const industry = request.query.industry;
    const allBenchmarks = store.all<BenchmarkEntry>('cloud_benchmarks');
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
    const patterns = store.all<LearnedPattern>('cloud_patterns');
    return reply.send({
      data: patterns.sort((a, b) => b.occurrences - a.occurrences),
      total: patterns.length,
      privacyNote: 'All patterns are aggregated from anonymized data. No individual organization data is shared.',
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/cloud/patterns/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const pattern = store.get<LearnedPattern>('cloud_patterns', request.params.id);
    if (!pattern) return reply.status(404).send({ error: 'Not Found', message: 'Pattern not found' });
    return reply.send({ data: pattern });
  });

  // ── Partner Certification ─────────────────────────────────────────────────

  app.get('/api/v1/cloud/partners', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const partners = store.all<PartnerCert>('cloud_applications');
    return reply.send({ data: partners, total: partners.length });
  });

  app.get<{ Params: { id: string } }>('/api/v1/cloud/partners/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const partner = store.get<PartnerCert>('cloud_applications', request.params.id);
    if (!partner) return reply.status(404).send({ error: 'Not Found', message: 'Partner not found' });
    return reply.send({ data: partner });
  });

  app.post('/api/v1/cloud/partners/apply', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = request.body as { partnerName?: string; specializations?: string[] };
    if (!body.partnerName) return reply.status(400).send({ error: 'Bad Request', message: 'partnerName is required' });

    const cert: PartnerCert = {
      id: generateId(),
      partnerName: body.partnerName,
      tier: 'silver',
      specializations: body.specializations ?? [],
      certifiedAt: nowISO(),
      expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
      status: 'pending',
    };
    store.set<PartnerCert>('cloud_applications', cert.id, cert);
    return reply.status(201).send({ data: cert, message: 'Application submitted. Review in 5 business days.' });
  });

  // ── Managed Services ──────────────────────────────────────────────────────

  app.get('/api/v1/cloud/services', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.send({ data: managedServices, total: managedServices.length });
  });

  // ── Cloud Platform Info ───────────────────────────────────────────────────

  app.get('/api/v1/cloud/info', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const benchmarkCount = store.count('cloud_benchmarks');
    return reply.send({
      data: {
        platform: 'Recurrsive Cloud',
        version: '0.4.0',
        status: 'preview',
        regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
        features: {
          benchmarking: { status: 'active', participants: benchmarkCount },
          patternLearning: { status: 'active', patterns: store.count('cloud_patterns') },
          managedServices: { status: 'active', tiers: managedServices.length },
          partnerProgram: { status: 'active', partners: store.count('cloud_applications') },
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
}
