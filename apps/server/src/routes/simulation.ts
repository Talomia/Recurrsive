/**
 * @module @recurrsive/server/routes/simulation
 *
 * Simulation engine and PR generation routes.
 *
 * Provides:
 * - Traffic replay simulation for impact prediction
 * - PR (pull request) generation from recommendations
 * - Domain intelligence packs for vertical-specific analysis
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Types — Simulation Engine
// ---------------------------------------------------------------------------

interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  type: 'traffic-replay' | 'load-test' | 'failure-injection' | 'dependency-change' | 'architecture-change';
  /** Parameters for the simulation. */
  parameters: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Simulation results. */
  results: SimulationResult | null;
  createdAt: string;
  completedAt: string | null;
}

interface SimulationResult {
  impactScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  findings: Array<{
    area: string;
    impact: string;
    probability: number;
    recommendation: string;
  }>;
  metrics: {
    estimatedLatencyChangeMs: number;
    estimatedErrorRateChange: number;
    estimatedCostChangePct: number;
    estimatedAvailabilityChange: number;
  };
  timeline: Array<{
    timestamp: string;
    event: string;
    metric: string;
    value: number;
  }>;
}

// ---------------------------------------------------------------------------
// Types — PR Generation
// ---------------------------------------------------------------------------

interface GeneratedPR {
  id: string;
  /** Source recommendation/opportunity ID. */
  sourceId: string;
  title: string;
  description: string;
  branch: string;
  /** File changes. */
  changes: Array<{
    path: string;
    action: 'create' | 'modify' | 'delete';
    additions: number;
    deletions: number;
    summary: string;
  }>;
  /** Estimated impact. */
  impact: {
    healthScoreChange: number;
    findingsResolved: number;
    coverageChange: number;
  };
  status: 'draft' | 'ready' | 'submitted' | 'merged' | 'declined';
  reviewers: string[];
  labels: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Types — Domain Intelligence Packs
// ---------------------------------------------------------------------------

interface IntelligencePack {
  id: string;
  name: string;
  domain: string;
  version: string;
  description: string;
  /** Specialized analyzers included. */
  analyzers: string[];
  /** Compliance frameworks covered. */
  frameworks: string[];
  /** Domain-specific entity types. */
  entityTypes: string[];
  /** Number of specialized rules. */
  ruleCount: number;
  status: 'available' | 'installed' | 'updating';
  author: string;
}

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

const simulations: Map<string, SimulationScenario> = new Map();
const generatedPRs: Map<string, GeneratedPR> = new Map();
const intelligencePacks: Map<string, IntelligencePack> = new Map();

// Seed intelligence packs
const packs: Array<Omit<IntelligencePack, 'id'>> = [
  {
    name: 'Healthcare Intelligence Pack',
    domain: 'healthcare',
    version: '1.0.0',
    description: 'HIPAA compliance, PHI data flow analysis, HL7/FHIR integration checks, clinical data governance.',
    analyzers: ['hipaa-compliance', 'phi-data-flow', 'clinical-data-governance', 'fhir-conformance'],
    frameworks: ['HIPAA', 'HITRUST', 'SOC2-Healthcare'],
    entityTypes: ['patient_record', 'clinical_system', 'ehr_integration', 'consent_flow'],
    ruleCount: 42,
    status: 'available',
    author: 'Recurrsive Team',
  },
  {
    name: 'Finance Intelligence Pack',
    domain: 'finance',
    version: '1.0.0',
    description: 'SOX compliance, PCI-DSS validation, fraud detection patterns, transaction integrity analysis.',
    analyzers: ['sox-compliance', 'pci-dss-validator', 'fraud-pattern-detector', 'transaction-integrity'],
    frameworks: ['SOX', 'PCI-DSS', 'SOC2', 'GLBA'],
    entityTypes: ['transaction_flow', 'payment_gateway', 'audit_trail', 'financial_report'],
    ruleCount: 56,
    status: 'available',
    author: 'Recurrsive Team',
  },
  {
    name: 'Kubernetes Intelligence Pack',
    domain: 'kubernetes',
    version: '1.2.0',
    description: 'K8s security policies, resource optimization, cluster health, Helm chart analysis.',
    analyzers: ['k8s-security', 'resource-optimizer', 'cluster-health', 'helm-analyzer'],
    frameworks: ['CIS-Kubernetes', 'NSA-CISA-K8s', 'Pod-Security-Standards'],
    entityTypes: ['deployment', 'pod_template', 'network_policy', 'service_mesh'],
    ruleCount: 38,
    status: 'available',
    author: 'Recurrsive Team',
  },
  {
    name: 'AI Safety Intelligence Pack',
    domain: 'ai-safety',
    version: '0.9.0',
    description: 'AI safety guardrails, bias detection, model explainability, prompt injection prevention.',
    analyzers: ['ai-bias-detector', 'prompt-injection-scanner', 'model-explainability', 'safety-guardrails'],
    frameworks: ['EU-AI-Act', 'NIST-AI-RMF', 'ISO-42001'],
    entityTypes: ['ml_model', 'training_dataset', 'fairness_metric', 'safety_guardrail'],
    ruleCount: 34,
    status: 'available',
    author: 'Recurrsive Team',
  },
];

for (const p of packs) {
  const id = generateId();
  intelligencePacks.set(id, { ...p, id });
}

// Seed demo simulation
const demoSim: SimulationScenario = {
  id: generateId(),
  name: 'Production Traffic Replay — Black Friday',
  description: 'Replays Black Friday 2025 traffic patterns against current architecture to predict bottlenecks.',
  type: 'traffic-replay',
  parameters: { trafficMultiplier: 3.5, duration: '4h', targetServices: ['api-gateway', 'payment-processor', 'inventory'] },
  status: 'completed',
  results: {
    impactScore: 7.2,
    riskLevel: 'high',
    findings: [
      { area: 'api-gateway', impact: 'Connection pool exhaustion at 2.5x baseline', probability: 0.85, recommendation: 'Increase connection pool to 500 and enable circuit breaker' },
      { area: 'payment-processor', impact: 'Timeout cascade under sustained 3x load', probability: 0.72, recommendation: 'Add queue-based decoupling with Redis' },
      { area: 'database', impact: 'Read replica lag exceeds 5s threshold', probability: 0.60, recommendation: 'Add read-through cache layer' },
    ],
    metrics: { estimatedLatencyChangeMs: 450, estimatedErrorRateChange: 0.032, estimatedCostChangePct: 280, estimatedAvailabilityChange: -0.015 },
    timeline: [
      { timestamp: '2026-11-28T08:00:00Z', event: 'Traffic ramp start', metric: 'rps', value: 1200 },
      { timestamp: '2026-11-28T10:00:00Z', event: 'Peak load reached', metric: 'rps', value: 4200 },
      { timestamp: '2026-11-28T10:15:00Z', event: 'Connection pool warning', metric: 'pool_utilization', value: 0.92 },
      { timestamp: '2026-11-28T10:30:00Z', event: 'First timeout cascade', metric: 'error_rate', value: 0.045 },
      { timestamp: '2026-11-28T14:00:00Z', event: 'Load plateau', metric: 'rps', value: 3800 },
    ],
  },
  createdAt: '2026-06-15T00:00:00Z',
  completedAt: '2026-06-15T04:30:00Z',
};
simulations.set(demoSim.id, demoSim);

// Seed demo PRs
const demoPRs: Array<Omit<GeneratedPR, 'id'>> = [
  {
    sourceId: generateId(),
    title: 'fix: add rate limiting to authentication endpoints',
    description: 'Adds token-bucket rate limiting to /auth/login and /auth/register to prevent brute force attacks.\n\nBased on security analyzer finding `security.missing-rate-limit`.',
    branch: 'fix/auth-rate-limiting',
    changes: [
      { path: 'apps/server/src/middleware/rate-limiter.ts', action: 'modify', additions: 35, deletions: 2, summary: 'Add auth-specific rate limit config' },
      { path: 'apps/server/src/routes/auth.ts', action: 'modify', additions: 12, deletions: 0, summary: 'Apply rate limiter to login/register' },
      { path: 'apps/server/src/__tests__/rate-limiter.test.ts', action: 'modify', additions: 28, deletions: 0, summary: 'Add rate limiter tests' },
    ],
    impact: { healthScoreChange: 2.5, findingsResolved: 3, coverageChange: 1.2 },
    status: 'ready',
    reviewers: ['sarah.chen', 'marcus.johnson'],
    labels: ['security', 'auto-generated', 'priority:high'],
    createdAt: nowISO(),
  },
  {
    sourceId: generateId(),
    title: 'refactor: extract shared validation utilities',
    description: 'Extracts duplicated Zod validation logic into a shared utilities module.\n\nBased on architecture analyzer finding `arch.code-duplication`.',
    branch: 'refactor/shared-validation',
    changes: [
      { path: 'packages/core/src/utils/validation.ts', action: 'create', additions: 85, deletions: 0, summary: 'New shared validation utilities' },
      { path: 'apps/server/src/routes/auth.ts', action: 'modify', additions: 3, deletions: 22, summary: 'Use shared validators' },
      { path: 'apps/server/src/routes/projects.ts', action: 'modify', additions: 3, deletions: 18, summary: 'Use shared validators' },
    ],
    impact: { healthScoreChange: 1.8, findingsResolved: 2, coverageChange: 0.5 },
    status: 'draft',
    reviewers: ['priya.patel'],
    labels: ['refactor', 'auto-generated', 'tech-debt'],
    createdAt: nowISO(),
  },
];

for (const pr of demoPRs) {
  const id = generateId();
  generatedPRs.set(id, { ...pr, id });
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerSimulationRoutes(app: FastifyInstance): Promise<void> {
  // ── Simulation Engine ─────────────────────────────────────────────────────

  app.get('/api/v1/simulations', async (_request, reply) => {
    return reply.send({ data: Array.from(simulations.values()), total: simulations.size });
  });

  app.get<{ Params: { id: string } }>('/api/v1/simulations/:id', async (request, reply) => {
    const sim = simulations.get(request.params.id);
    if (!sim) return reply.status(404).send({ error: 'Not Found', message: 'Simulation not found' });
    return reply.send({ data: sim });
  });

  app.post('/api/v1/simulations', async (request, reply) => {
    const body = request.body as { name?: string; description?: string; type?: SimulationScenario['type']; parameters?: Record<string, unknown> };
    if (!body.name || !body.type) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name and type are required' });
    }

    const id = generateId();
    const sim: SimulationScenario = {
      id,
      name: body.name,
      description: body.description ?? '',
      type: body.type,
      parameters: body.parameters ?? {},
      status: 'completed', // Simulate instant completion for demo
      results: {
        impactScore: Math.round((3 + Math.random() * 7) * 10) / 10,
        riskLevel: (['low', 'medium', 'high'] as const)[Math.floor(Math.random() * 3)]!,
        findings: [
          { area: 'system', impact: 'Moderate performance impact detected', probability: 0.65, recommendation: 'Review resource allocation' },
        ],
        metrics: {
          estimatedLatencyChangeMs: Math.round(50 + Math.random() * 400),
          estimatedErrorRateChange: Math.round(Math.random() * 0.05 * 1000) / 1000,
          estimatedCostChangePct: Math.round(10 + Math.random() * 100),
          estimatedAvailabilityChange: -Math.round(Math.random() * 0.01 * 1000) / 1000,
        },
        timeline: [],
      },
      createdAt: nowISO(),
      completedAt: nowISO(),
    };

    simulations.set(id, sim);
    return reply.status(201).send({ data: sim });
  });

  // ── PR Generation ─────────────────────────────────────────────────────────

  app.get('/api/v1/pull-requests', async (_request, reply) => {
    return reply.send({ data: Array.from(generatedPRs.values()), total: generatedPRs.size });
  });

  app.get<{ Params: { id: string } }>('/api/v1/pull-requests/:id', async (request, reply) => {
    const pr = generatedPRs.get(request.params.id);
    if (!pr) return reply.status(404).send({ error: 'Not Found', message: 'PR not found' });
    return reply.send({ data: pr });
  });

  app.post('/api/v1/pull-requests/generate', async (request, reply) => {
    const body = request.body as { sourceId?: string; title?: string; description?: string };
    if (!body.title) {
      return reply.status(400).send({ error: 'Bad Request', message: 'title is required' });
    }

    const id = generateId();
    const pr: GeneratedPR = {
      id,
      sourceId: body.sourceId ?? generateId(),
      title: body.title,
      description: body.description ?? '',
      branch: `auto/${body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
      changes: [],
      impact: { healthScoreChange: 0, findingsResolved: 0, coverageChange: 0 },
      status: 'draft',
      reviewers: [],
      labels: ['auto-generated'],
      createdAt: nowISO(),
    };

    generatedPRs.set(id, pr);
    return reply.status(201).send({ data: pr });
  });

  app.post<{ Params: { id: string } }>('/api/v1/pull-requests/:id/submit', async (request, reply) => {
    const pr = generatedPRs.get(request.params.id);
    if (!pr) return reply.status(404).send({ error: 'Not Found', message: 'PR not found' });

    pr.status = 'submitted';
    return reply.send({ data: pr, message: 'PR submitted for review' });
  });

  // ── Domain Intelligence Packs ─────────────────────────────────────────────

  app.get('/api/v1/intelligence-packs', async (_request, reply) => {
    return reply.send({ data: Array.from(intelligencePacks.values()), total: intelligencePacks.size });
  });

  app.get<{ Params: { id: string } }>('/api/v1/intelligence-packs/:id', async (request, reply) => {
    const pack = intelligencePacks.get(request.params.id);
    if (!pack) return reply.status(404).send({ error: 'Not Found', message: 'Intelligence pack not found' });
    return reply.send({ data: pack });
  });

  app.post<{ Params: { id: string } }>('/api/v1/intelligence-packs/:id/install', async (request, reply) => {
    const pack = intelligencePacks.get(request.params.id);
    if (!pack) return reply.status(404).send({ error: 'Not Found', message: 'Intelligence pack not found' });

    if (pack.status === 'installed') {
      return reply.status(409).send({ error: 'Conflict', message: 'Pack already installed' });
    }

    pack.status = 'installed';
    return reply.send({ data: pack, message: `${pack.name} installed successfully. ${pack.ruleCount} rules activated.` });
  });

  app.delete<{ Params: { id: string } }>('/api/v1/intelligence-packs/:id/uninstall', async (request, reply) => {
    const pack = intelligencePacks.get(request.params.id);
    if (!pack) return reply.status(404).send({ error: 'Not Found', message: 'Intelligence pack not found' });

    pack.status = 'available';
    return reply.send({ data: pack, message: 'Pack uninstalled' });
  });
}
