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
import { state } from '../state.js';
import { store } from '../store.js';

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
// Seed data
// ---------------------------------------------------------------------------

function seedIfEmpty(): void {
  // Intelligence packs remain seeded since they represent domain-specific templates
  if (store.count('intelligence_packs') === 0) {
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
      store.set<IntelligencePack>('intelligence_packs', id, { ...p, id });
    }
  }

  // No seed simulations or PRs — created via the API
}

seedIfEmpty();

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerSimulationRoutes(app: FastifyInstance): Promise<void> {
  // ── Simulation Engine ─────────────────────────────────────────────────────

  app.get('/api/v1/simulations', async (_request, reply) => {
    const all = store.all<SimulationScenario>('simulations');
    return reply.send({ data: all, total: all.length });
  });

  app.get<{ Params: { id: string } }>('/api/v1/simulations/:id', async (request, reply) => {
    const sim = store.get<SimulationScenario>('simulations', request.params.id);
    if (!sim) return reply.status(404).send({ error: 'Not Found', message: 'Simulation not found' });
    return reply.send({ data: sim });
  });

  app.post('/api/v1/simulations', async (request, reply) => {
    const body = request.body as { name?: string; description?: string; type?: SimulationScenario['type']; parameters?: Record<string, unknown> };
    if (!body.name || !body.type) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name and type are required' });
    }

    const id = generateId();

    // Compute results from real analysis data when available
    const cache = state.isInitialized() ? state.getAnalysisCache() : null;
    const findings = cache?.findings ?? [];
    const healthScore = state.isInitialized() ? state.getHealthScore().overall : 50;

    // Derive impact score from finding severity distribution
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;
    const impactScore = Math.round(Math.min(10, (criticalCount * 3 + highCount * 1.5 + findings.length * 0.3)) * 10) / 10;

    // Derive risk level from actual severity distribution
    const riskLevel: 'low' | 'medium' | 'high' = criticalCount > 0 ? 'high' : highCount > 2 ? 'medium' : 'low';

    // Generate findings from real analysis findings, not random data
    const simFindings = findings.slice(0, 5).map(f => ({
      area: f.category ?? 'architecture' as const,
      impact: f.description.slice(0, 80),
      probability: f.severity === 'critical' ? 0.9 : f.severity === 'high' ? 0.7 : f.severity === 'medium' ? 0.5 : 0.3,
      recommendation: f.title ?? `Address ${f.severity} finding in ${f.category ?? 'system'}`,
    }));

    // If no real findings, provide a meaningful empty result
    if (simFindings.length === 0) {
      simFindings.push({
        area: 'architecture' as const,
        impact: 'No active findings to simulate against',
        probability: 0,
        recommendation: 'Run an analysis first to generate meaningful simulation results',
      });
    }

    const sim: SimulationScenario = {
      id,
      name: body.name,
      description: body.description ?? '',
      type: body.type,
      parameters: body.parameters ?? {},
      status: 'completed',
      results: {
        impactScore,
        riskLevel,
        findings: simFindings,
        metrics: {
          estimatedLatencyChangeMs: Math.round(criticalCount * 100 + highCount * 50),
          estimatedErrorRateChange: Math.round(criticalCount * 0.01 * 1000) / 1000,
          estimatedCostChangePct: Math.round((100 - healthScore) * 1.5),
          estimatedAvailabilityChange: -Math.round(criticalCount * 0.002 * 1000) / 1000,
        },
        timeline: [],
      },
      createdAt: nowISO(),
      completedAt: nowISO(),
    };

    store.set<SimulationScenario>('simulations', id, sim);
    return reply.status(201).send({ data: sim });
  });

  // ── PR Generation ─────────────────────────────────────────────────────────

  app.get('/api/v1/pull-requests', async (_request, reply) => {
    const all = store.all<GeneratedPR>('pull_requests');
    return reply.send({ data: all, total: all.length });
  });

  app.get<{ Params: { id: string } }>('/api/v1/pull-requests/:id', async (request, reply) => {
    const pr = store.get<GeneratedPR>('pull_requests', request.params.id);
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

    store.set<GeneratedPR>('pull_requests', id, pr);
    return reply.status(201).send({ data: pr });
  });

  app.post<{ Params: { id: string } }>('/api/v1/pull-requests/:id/submit', async (request, reply) => {
    const pr = store.get<GeneratedPR>('pull_requests', request.params.id);
    if (!pr) return reply.status(404).send({ error: 'Not Found', message: 'PR not found' });

    pr.status = 'submitted';
    store.set<GeneratedPR>('pull_requests', pr.id, pr);
    return reply.send({ data: pr, message: 'PR submitted for review' });
  });

  // ── Domain Intelligence Packs ─────────────────────────────────────────────

  app.get('/api/v1/intelligence-packs', async (_request, reply) => {
    const all = store.all<IntelligencePack>('intelligence_packs');
    return reply.send({ data: all, total: all.length });
  });

  app.get<{ Params: { id: string } }>('/api/v1/intelligence-packs/:id', async (request, reply) => {
    const pack = store.get<IntelligencePack>('intelligence_packs', request.params.id);
    if (!pack) return reply.status(404).send({ error: 'Not Found', message: 'Intelligence pack not found' });
    return reply.send({ data: pack });
  });

  app.post<{ Params: { id: string } }>('/api/v1/intelligence-packs/:id/install', async (request, reply) => {
    const pack = store.get<IntelligencePack>('intelligence_packs', request.params.id);
    if (!pack) return reply.status(404).send({ error: 'Not Found', message: 'Intelligence pack not found' });

    if (pack.status === 'installed') {
      return reply.status(409).send({ error: 'Conflict', message: 'Pack already installed' });
    }

    pack.status = 'installed';
    store.set<IntelligencePack>('intelligence_packs', pack.id, pack);
    return reply.send({ data: pack, message: `${pack.name} installed successfully. ${pack.ruleCount} rules activated.` });
  });

  app.delete<{ Params: { id: string } }>('/api/v1/intelligence-packs/:id/uninstall', async (request, reply) => {
    const pack = store.get<IntelligencePack>('intelligence_packs', request.params.id);
    if (!pack) return reply.status(404).send({ error: 'Not Found', message: 'Intelligence pack not found' });

    pack.status = 'available';
    store.set<IntelligencePack>('intelligence_packs', pack.id, pack);
    return reply.send({ data: pack, message: 'Pack uninstalled' });
  });
}
