/**
 * @module @recurrsive/server/routes/marketplace
 *
 * Marketplace routes for browsing, searching, and managing extensions.
 *
 * Provides:
 * - Extension catalog with built-in and community extensions
 * - Category browsing and search
 * - Extension submission and management
 * - Marketplace statistics
 *
 * Data is stored in-memory with realistic seeded content.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExtensionCategory = 'analyzer' | 'collector' | 'policy' | 'intelligence-pack';
export type ExtensionStatus = 'published' | 'draft' | 'review' | 'deprecated';
export type ExtensionSource = 'built-in' | 'community' | 'partner';

export interface MarketplaceExtension {
  id: string;
  name: string;
  slug: string;
  category: ExtensionCategory;
  source: ExtensionSource;
  author: string;
  description: string;
  longDescription: string;
  version: string;
  downloads: number;
  rating: number;
  ratingCount: number;
  status: ExtensionStatus;
  tags: string[];
  repository?: string;
  documentation?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtensionSubmission {
  name: string;
  category: ExtensionCategory;
  description: string;
  repositoryUrl: string;
  author: string;
  version: string;
}

// ---------------------------------------------------------------------------
// In-memory extension catalog
// ---------------------------------------------------------------------------

const extensions: Map<string, MarketplaceExtension> = new Map();

// Seed built-in analyzers
const BUILT_IN_ANALYZERS: Array<{ name: string; slug: string; desc: string; tags: string[] }> = [
  { name: 'Architecture Analyzer', slug: 'architecture', desc: 'Detects coupling, cohesion, layering violations, and circular dependencies across your codebase.', tags: ['architecture', 'coupling', 'modules'] },
  { name: 'Performance Analyzer', slug: 'performance', desc: 'Identifies N+1 queries, unbounded loops, memory leaks, and other runtime performance issues.', tags: ['performance', 'optimization', 'runtime'] },
  { name: 'Security Analyzer', slug: 'security', desc: 'Scans for injection vulnerabilities, auth bypass, secret exposure, and OWASP Top 10 issues.', tags: ['security', 'vulnerabilities', 'owasp'] },
  { name: 'Cost Analyzer', slug: 'cost', desc: 'Finds infrastructure waste, over-provisioning, idle resources, and cost optimization opportunities.', tags: ['cost', 'infrastructure', 'cloud'] },
  { name: 'Data Analyzer', slug: 'data', desc: 'Detects schema drift, missing indexes, query inefficiencies, and data modeling issues.', tags: ['data', 'database', 'schema'] },
  { name: 'Documentation Analyzer', slug: 'documentation', desc: 'Identifies documentation coverage gaps, stale docs, and missing API documentation.', tags: ['documentation', 'coverage', 'api-docs'] },
  { name: 'DevOps Analyzer', slug: 'devops', desc: 'Detects CI/CD anti-patterns, deployment risks, and infrastructure-as-code issues.', tags: ['devops', 'ci-cd', 'deployment'] },
  { name: 'API Contract Analyzer', slug: 'api-contract', desc: 'Validates API contracts, detects breaking changes, and checks OpenAPI compliance.', tags: ['api', 'contracts', 'openapi'] },
  { name: 'Dependency Analyzer', slug: 'dependency', desc: 'Scans for CVEs, outdated packages, license conflicts, and supply chain risks.', tags: ['dependencies', 'security', 'supply-chain'] },
  { name: 'Code Quality Analyzer', slug: 'code-quality', desc: 'Measures complexity, duplication, dead code, naming conventions, and code smells.', tags: ['quality', 'complexity', 'clean-code'] },
  { name: 'Reliability Analyzer', slug: 'reliability', desc: 'Checks error handling patterns, retry logic, circuit breakers, and graceful degradation.', tags: ['reliability', 'resilience', 'error-handling'] },
  { name: 'AI Runtime Analyzer', slug: 'ai-runtime', desc: 'Evaluates prompt quality, token usage, model selection, and LLM integration patterns.', tags: ['ai', 'llm', 'prompts'] },
  { name: 'AI Patterns Analyzer', slug: 'ai-patterns', desc: 'Analyzes RAG quality, agent loops, tool misuse, and AI pipeline best practices.', tags: ['ai', 'rag', 'agents', 'patterns'] },
];

const BUILT_IN_COLLECTORS: Array<{ name: string; slug: string; desc: string; tags: string[] }> = [
  { name: 'Git Collector', slug: 'git', desc: 'Collects repository history, commits, branches, and contributor data.', tags: ['git', 'vcs', 'history'] },
  { name: 'GitHub Collector', slug: 'github', desc: 'Ingests pull requests, issues, reviews, actions, and deployment data from GitHub.', tags: ['github', 'prs', 'issues'] },
  { name: 'GitLab Collector', slug: 'gitlab', desc: 'Ingests merge requests, issues, pipelines, and environments from GitLab.', tags: ['gitlab', 'pipelines', 'mrs'] },
  { name: 'OpenTelemetry Collector', slug: 'opentelemetry', desc: 'Receives OTLP traces, metrics, and spans for runtime analysis.', tags: ['opentelemetry', 'traces', 'metrics'] },
  { name: 'Cloud Cost Collector', slug: 'cloud-cost', desc: 'Pulls billing and usage data from AWS, GCP, and Azure.', tags: ['cloud', 'cost', 'billing'] },
  { name: 'Error Tracking Collector', slug: 'error-tracking', desc: 'Integrates with Sentry, Bugsnag, and Rollbar for error data.', tags: ['errors', 'sentry', 'tracking'] },
  { name: 'APM Collector', slug: 'apm', desc: 'Connects to Datadog, New Relic, and Grafana for APM data.', tags: ['apm', 'monitoring', 'datadog'] },
  { name: 'Database Collector', slug: 'database', desc: 'Collects schema information from SQL, Prisma, and Drizzle ORMs.', tags: ['database', 'sql', 'orm'] },
  { name: 'Langfuse Collector', slug: 'langfuse', desc: 'Ingests LLM traces and prompt analytics from Langfuse.', tags: ['langfuse', 'llm', 'traces'] },
  { name: 'Arize Collector', slug: 'arize', desc: 'Pulls model monitoring and drift detection data from Arize.', tags: ['arize', 'ml', 'monitoring'] },
  { name: 'Helicone Collector', slug: 'helicone', desc: 'Tracks LLM cost and usage data from Helicone.', tags: ['helicone', 'llm', 'cost'] },
  { name: 'CI/CD Collector', slug: 'ci-cd', desc: 'Collects pipeline data from GitHub Actions and GitLab CI.', tags: ['ci-cd', 'pipelines', 'github-actions'] },
  { name: 'Documentation Collector', slug: 'docs', desc: 'Scans Markdown files, JSDoc comments, and docstrings.', tags: ['docs', 'markdown', 'jsdoc'] },
  { name: 'Environment Collector', slug: 'environment', desc: 'Collects Docker, Kubernetes, config files, and secrets metadata.', tags: ['environment', 'docker', 'k8s'] },
];

const COMMUNITY_EXTENSIONS: Array<{ name: string; slug: string; desc: string; category: ExtensionCategory; tags: string[]; author: string; downloads: number; rating: number; ratingCount: number }> = [
  { name: 'Kubernetes Analyzer', slug: 'kubernetes', desc: 'Analyzes Kubernetes manifests, Helm charts, and cluster configurations for best practices.', category: 'analyzer', tags: ['kubernetes', 'k8s', 'helm'], author: 'CloudForge Labs', downloads: 3842, rating: 4.7, ratingCount: 89 },
  { name: 'Healthcare Compliance Pack', slug: 'healthcare-compliance', desc: 'HIPAA compliance policies for healthcare engineering teams.', category: 'policy', tags: ['hipaa', 'healthcare', 'compliance'], author: 'MedTech Assurance', downloads: 1256, rating: 4.9, ratingCount: 42 },
  { name: 'FinOps Optimizer', slug: 'finops-optimizer', desc: 'Advanced cost optimization intelligence pack for cloud-native applications.', category: 'intelligence-pack', tags: ['finops', 'cost', 'cloud'], author: 'FinTech Assurance Group', downloads: 2190, rating: 4.6, ratingCount: 67 },
  { name: 'Terraform Collector', slug: 'terraform', desc: 'Collects infrastructure-as-code state from Terraform and OpenTofu.', category: 'collector', tags: ['terraform', 'iac', 'opentofu'], author: 'Platform Engineering Co', downloads: 4521, rating: 4.8, ratingCount: 112 },
  { name: 'SOC 2 Compliance Pack', slug: 'soc2-compliance', desc: 'SOC 2 Type II compliance policies and audit evidence generation.', category: 'policy', tags: ['soc2', 'compliance', 'audit'], author: 'AI Safety Labs', downloads: 987, rating: 4.5, ratingCount: 31 },
  { name: 'GraphQL Analyzer', slug: 'graphql-analyzer', desc: 'Analyzes GraphQL schemas for complexity, depth limiting, and performance anti-patterns.', category: 'analyzer', tags: ['graphql', 'api', 'schema'], author: 'DevOps Pro Solutions', downloads: 1678, rating: 4.4, ratingCount: 53 },
];

// Seed all extensions
function seedExtensions() {
  const now = nowISO();
  let seeded = false;

  BUILT_IN_ANALYZERS.forEach((a) => {
    const id = `builtin-analyzer-${a.slug}`;
    if (!extensions.has(id)) {
      extensions.set(id, {
        id,
        name: a.name,
        slug: a.slug,
        category: 'analyzer',
        source: 'built-in',
        author: 'Recurrsive',
        description: a.desc,
        longDescription: `${a.desc}\n\nThis analyzer is part of the core Recurrsive platform and is maintained by the Recurrsive team. It integrates with the multi-agent reasoning pipeline for evidence-backed recommendations.`,
        version: '0.5.0',
        downloads: Math.floor(Math.random() * 15000) + 5000,
        rating: 4.5 + Math.random() * 0.5,
        ratingCount: Math.floor(Math.random() * 200) + 50,
        status: 'published',
        tags: a.tags,
        repository: 'https://github.com/Talomia/Recurrsive',
        documentation: 'https://recurrsive.dev/docs/plugin-sdk',
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: now,
      });
      seeded = true;
    }
  });

  BUILT_IN_COLLECTORS.forEach((c) => {
    const id = `builtin-collector-${c.slug}`;
    if (!extensions.has(id)) {
      extensions.set(id, {
        id,
        name: c.name,
        slug: c.slug,
        category: 'collector',
        source: 'built-in',
        author: 'Recurrsive',
        description: c.desc,
        longDescription: `${c.desc}\n\nThis collector is included in the core Recurrsive platform. Configure it via recurrsive.config.ts or the CLI.`,
        version: '0.5.0',
        downloads: Math.floor(Math.random() * 12000) + 3000,
        rating: 4.3 + Math.random() * 0.7,
        ratingCount: Math.floor(Math.random() * 150) + 30,
        status: 'published',
        tags: c.tags,
        repository: 'https://github.com/Talomia/Recurrsive',
        documentation: 'https://recurrsive.dev/docs/plugin-sdk',
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: now,
      });
      seeded = true;
    }
  });

  COMMUNITY_EXTENSIONS.forEach((e) => {
    const id = `community-${e.slug}`;
    if (!extensions.has(id)) {
      extensions.set(id, {
        id,
        name: e.name,
        slug: e.slug,
        category: e.category,
        source: 'community',
        author: e.author,
        description: e.desc,
        longDescription: `${e.desc}\n\nDeveloped and maintained by ${e.author}. Verified by the Recurrsive team for compatibility and security.`,
        version: '1.0.0',
        downloads: e.downloads,
        rating: e.rating,
        ratingCount: e.ratingCount,
        status: 'published',
        tags: e.tags,
        repository: `https://github.com/${e.author.toLowerCase().replace(/\s+/g, '-')}/${e.slug}`,
        createdAt: '2026-06-15T00:00:00Z',
        updatedAt: now,
      });
      seeded = true;
    }
  });

  return seeded;
}

seedExtensions();

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function registerMarketplaceRoutes(app: FastifyInstance): Promise<void> {
  const prefix = '/api/v1/marketplace';

  /**
   * GET /api/v1/marketplace/extensions
   *
   * List marketplace extensions with optional filtering.
   *
   * Query params: category, source, search, sort (downloads|rating|name), limit, offset
   */
  app.get(`${prefix}/extensions`, async (request, reply) => {
    const query = request.query as {
      category?: ExtensionCategory;
      source?: ExtensionSource;
      search?: string;
      sort?: 'downloads' | 'rating' | 'name' | 'newest';
      limit?: string;
      offset?: string;
    };

    let results = Array.from(extensions.values())
      .filter((e) => e.status === 'published');

    // Filter by category
    if (query.category) {
      results = results.filter((e) => e.category === query.category);
    }

    // Filter by source
    if (query.source) {
      results = results.filter((e) => e.source === query.source);
    }

    // Search by name, description, or tags
    if (query.search) {
      const term = query.search.toLowerCase();
      results = results.filter(
        (e) =>
          e.name.toLowerCase().includes(term) ||
          e.description.toLowerCase().includes(term) ||
          e.tags.some((t) => t.includes(term)),
      );
    }

    // Sort
    switch (query.sort) {
      case 'downloads':
        results.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'rating':
        results.sort((a, b) => b.rating - a.rating);
        break;
      case 'name':
        results.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'newest':
        results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
      default:
        results.sort((a, b) => b.downloads - a.downloads);
    }

    const limit = Math.min(parseInt(query.limit ?? '50', 10), 100);
    const offset = parseInt(query.offset ?? '0', 10);
    const paged = results.slice(offset, offset + limit);

    return reply.send({
      data: paged,
      total: results.length,
      limit,
      offset,
      categories: {
        analyzer: results.filter((e) => e.category === 'analyzer').length,
        collector: results.filter((e) => e.category === 'collector').length,
        policy: results.filter((e) => e.category === 'policy').length,
        'intelligence-pack': results.filter((e) => e.category === 'intelligence-pack').length,
      },
    });
  });

  /**
   * GET /api/v1/marketplace/extensions/:id
   *
   * Get extension detail.
   */
  app.get(`${prefix}/extensions/:id`, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ext = extensions.get(id);
    if (!ext) {
      return reply.status(404).send({ error: 'Extension not found' });
    }
    return reply.send({ data: ext });
  });

  /**
   * POST /api/v1/marketplace/extensions
   *
   * Submit a new extension for review.
   */
  app.post(`${prefix}/extensions`, async (request, reply) => {
    const body = request.body as ExtensionSubmission;

    if (!body.name || !body.category || !body.description || !body.repositoryUrl) {
      return reply.status(400).send({
        error: 'Missing required fields: name, category, description, repositoryUrl',
      });
    }

    const id = generateId();
    const now = nowISO();

    const ext: MarketplaceExtension = {
      id,
      name: body.name,
      slug: body.name.toLowerCase().replace(/\s+/g, '-'),
      category: body.category,
      source: 'community',
      author: body.author || 'Unknown',
      description: body.description,
      longDescription: body.description,
      version: body.version || '0.1.0',
      downloads: 0,
      rating: 0,
      ratingCount: 0,
      status: 'review',
      tags: [],
      repository: body.repositoryUrl,
      createdAt: now,
      updatedAt: now,
    };

    extensions.set(id, ext);

    return reply.status(201).send({ data: ext, message: 'Extension submitted for review' });
  });

  /**
   * GET /api/v1/marketplace/categories
   *
   * List available categories with counts.
   */
  app.get(`${prefix}/categories`, async (_request, reply) => {
    const all = Array.from(extensions.values()).filter((e) => e.status === 'published');
    return reply.send({
      data: [
        { id: 'analyzer', name: 'Analyzers', description: 'Deep analysis of code, architecture, and patterns', count: all.filter((e) => e.category === 'analyzer').length },
        { id: 'collector', name: 'Collectors', description: 'Ingest data from external systems and tools', count: all.filter((e) => e.category === 'collector').length },
        { id: 'policy', name: 'Policies', description: 'Governance rules and compliance frameworks', count: all.filter((e) => e.category === 'policy').length },
        { id: 'intelligence-pack', name: 'Intelligence Packs', description: 'Pre-built reasoning configurations', count: all.filter((e) => e.category === 'intelligence-pack').length },
      ],
    });
  });

  /**
   * GET /api/v1/marketplace/stats
   *
   * Marketplace statistics.
   */
  app.get(`${prefix}/stats`, async (_request, reply) => {
    const all = Array.from(extensions.values());
    const published = all.filter((e) => e.status === 'published');
    const totalDownloads = published.reduce((sum, e) => sum + e.downloads, 0);
    const avgRating = published.length > 0
      ? published.reduce((sum, e) => sum + e.rating, 0) / published.length
      : 0;

    return reply.send({
      data: {
        totalExtensions: published.length,
        totalDownloads,
        averageRating: Math.round(avgRating * 10) / 10,
        categoryCounts: {
          analyzer: published.filter((e) => e.category === 'analyzer').length,
          collector: published.filter((e) => e.category === 'collector').length,
          policy: published.filter((e) => e.category === 'policy').length,
          'intelligence-pack': published.filter((e) => e.category === 'intelligence-pack').length,
        },
        sourceCounts: {
          'built-in': published.filter((e) => e.source === 'built-in').length,
          community: published.filter((e) => e.source === 'community').length,
          partner: published.filter((e) => e.source === 'partner').length,
        },
      },
    });
  });
}
