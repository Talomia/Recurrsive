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
 * All data is synthetic / demonstration-only.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';

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
// In-memory stores
// ---------------------------------------------------------------------------

const benchmarks: BenchmarkEntry[] = [];
const patterns: LearnedPattern[] = [];
const partners: PartnerCert[] = [];

// Seed benchmarks
const industries = ['fintech', 'healthcare', 'e-commerce', 'saas', 'devtools', 'gaming', 'media'];
for (let i = 0; i < 50; i++) {
  const overall = 40 + Math.random() * 50;
  benchmarks.push({
    id: generateId(),
    anonymizedTenantId: `anon-${generateId().slice(0, 8)}`,
    industry: industries[i % industries.length]!,
    teamSize: (['small', 'medium', 'large', 'enterprise'] as const)[i % 4]!,
    scores: {
      overall: Math.round(overall * 10) / 10,
      architecture: Math.round((overall + (Math.random() - 0.5) * 20) * 10) / 10,
      security: Math.round((overall + (Math.random() - 0.5) * 20) * 10) / 10,
      performance: Math.round((overall + (Math.random() - 0.5) * 20) * 10) / 10,
      reliability: Math.round((overall + (Math.random() - 0.5) * 20) * 10) / 10,
      documentation: Math.round((overall + (Math.random() - 0.5) * 30) * 10) / 10,
    },
    meta: {
      codebaseSize: (['small', 'medium', 'large'] as const)[i % 3]!,
      primaryLanguage: (['TypeScript', 'Python', 'Go', 'Java', 'Rust'] as const)[i % 5]!,
      analyzersUsed: 5 + Math.floor(Math.random() * 9),
      collectorsUsed: 3 + Math.floor(Math.random() * 12),
    },
    submittedAt: new Date(Date.now() - Math.floor(Math.random() * 90) * 86400000).toISOString(),
  });
}

// Seed learned patterns
const patternData: Array<Omit<LearnedPattern, 'id'>> = [
  { name: 'Missing API rate limiting', category: 'security', occurrences: 342, successRate: 0.91, avgImpact: 4.2, recommendation: 'Add token-bucket rate limiting to all public endpoints', confidence: 0.95 },
  { name: 'Unused dependency accumulation', category: 'dependency', occurrences: 567, successRate: 0.88, avgImpact: 2.1, recommendation: 'Run depcheck quarterly to remove unused packages', confidence: 0.92 },
  { name: 'Insufficient error handling in async flows', category: 'reliability', occurrences: 445, successRate: 0.82, avgImpact: 5.3, recommendation: 'Wrap all async operations with structured error handling', confidence: 0.89 },
  { name: 'Documentation drift from implementation', category: 'documentation', occurrences: 623, successRate: 0.75, avgImpact: 3.1, recommendation: 'Integrate doc generation into CI pipeline', confidence: 0.87 },
  { name: 'LLM calls without cost tracking', category: 'ai', occurrences: 189, successRate: 0.93, avgImpact: 6.7, recommendation: 'Implement usage metering with per-request cost attribution', confidence: 0.91 },
  { name: 'Missing health check endpoints', category: 'reliability', occurrences: 298, successRate: 0.95, avgImpact: 3.8, recommendation: 'Add /health and /ready endpoints to all services', confidence: 0.94 },
  { name: 'Hardcoded secrets in configuration', category: 'security', occurrences: 412, successRate: 0.97, avgImpact: 8.2, recommendation: 'Migrate all secrets to a vault or environment variables', confidence: 0.98 },
  { name: 'Missing database index on frequently queried columns', category: 'performance', occurrences: 356, successRate: 0.86, avgImpact: 4.5, recommendation: 'Profile slow queries and add composite indexes', confidence: 0.88 },
];
for (const p of patternData) {
  patterns.push({ ...p, id: generateId() });
}

// Seed partners
const partnerData: Array<Omit<PartnerCert, 'id'>> = [
  { partnerName: 'CloudForge Consulting', tier: 'platinum', specializations: ['cloud-migration', 'security-hardening', 'ai-integration'], certifiedAt: '2026-01-15T00:00:00Z', expiresAt: '2027-01-15T00:00:00Z', status: 'active' },
  { partnerName: 'DevOps Pro Solutions', tier: 'gold', specializations: ['ci-cd', 'kubernetes', 'monitoring'], certifiedAt: '2026-03-01T00:00:00Z', expiresAt: '2027-03-01T00:00:00Z', status: 'active' },
  { partnerName: 'AI Safety Labs', tier: 'silver', specializations: ['ai-safety', 'llm-governance', 'bias-detection'], certifiedAt: '2026-05-01T00:00:00Z', expiresAt: '2027-05-01T00:00:00Z', status: 'active' },
  { partnerName: 'FinTech Assurance Group', tier: 'gold', specializations: ['financial-compliance', 'pci-dss', 'fraud-detection'], certifiedAt: '2026-04-01T00:00:00Z', expiresAt: '2027-04-01T00:00:00Z', status: 'active' },
];
for (const p of partnerData) {
  partners.push({ ...p, id: generateId() });
}

// Managed services catalog
const managedServices: ManagedService[] = [
  { id: generateId(), name: 'Recurrsive Cloud Starter', description: 'Fully managed Recurrsive instance with automated analysis, dashboard, and email reports.', tier: 'starter', features: ['Hosted dashboard', 'Daily analysis runs', 'Email reports', '5 projects', '3 users'], priceRange: '$99/mo', sla: '99.5% uptime' },
  { id: generateId(), name: 'Recurrsive Cloud Professional', description: 'Professional tier with advanced features, priority support, and custom integrations.', tier: 'professional', features: ['Everything in Starter', 'Real-time analysis', 'Webhook integrations', '20 projects', '25 users', 'SSO', 'Priority support'], priceRange: '$499/mo', sla: '99.9% uptime' },
  { id: generateId(), name: 'Recurrsive Cloud Enterprise', description: 'Enterprise-grade deployment with dedicated infrastructure, SLAs, and managed optimization.', tier: 'enterprise', features: ['Everything in Professional', 'Dedicated infrastructure', 'Custom domains', 'Unlimited projects', 'Unlimited users', 'Managed optimization', '24/7 support', 'Custom SLA'], priceRange: 'Custom', sla: '99.99% uptime' },
  { id: generateId(), name: 'Optimization-as-a-Service', description: 'Our expert team reviews your findings and implements improvements on your behalf.', tier: 'addon', features: ['Monthly review sessions', 'PR generation', 'Architecture recommendations', 'Dedicated success engineer'], priceRange: '$2,000/mo', sla: 'Included with Enterprise' },
];

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
    benchmarks.push(entry);
    return reply.status(201).send({ data: { id: entry.id, message: 'Benchmark submitted (anonymized)' } });
  });

  // Get benchmark report
  app.get<{ Querystring: { industry?: string } }>('/api/v1/cloud/benchmarks/report', { preHandler: [authMiddleware] }, async (request, reply) => {
    const industry = request.query.industry;
    const entries = industry ? benchmarks.filter(b => b.industry === industry) : benchmarks;

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
    return reply.send({
      data: patterns.sort((a, b) => b.occurrences - a.occurrences),
      total: patterns.length,
      privacyNote: 'All patterns are aggregated from anonymized data. No individual organization data is shared.',
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/cloud/patterns/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const pattern = patterns.find(p => p.id === request.params.id);
    if (!pattern) return reply.status(404).send({ error: 'Not Found', message: 'Pattern not found' });
    return reply.send({ data: pattern });
  });

  // ── Partner Certification ─────────────────────────────────────────────────

  app.get('/api/v1/cloud/partners', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.send({ data: partners, total: partners.length });
  });

  app.get<{ Params: { id: string } }>('/api/v1/cloud/partners/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const partner = partners.find(p => p.id === request.params.id);
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
    partners.push(cert);
    return reply.status(201).send({ data: cert, message: 'Application submitted. Review in 5 business days.' });
  });

  // ── Managed Services ──────────────────────────────────────────────────────

  app.get('/api/v1/cloud/services', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.send({ data: managedServices, total: managedServices.length });
  });

  // ── Cloud Platform Info ───────────────────────────────────────────────────

  app.get('/api/v1/cloud/info', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.send({
      data: {
        platform: 'Recurrsive Cloud',
        version: '0.4.0',
        status: 'preview',
        regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
        features: {
          benchmarking: { status: 'active', participants: benchmarks.length },
          patternLearning: { status: 'active', patterns: patterns.length },
          managedServices: { status: 'active', tiers: managedServices.length },
          partnerProgram: { status: 'active', partners: partners.length },
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
