/**
 * @module @recurrsive/server/routes/projects
 *
 * Multi-project support routes.
 *
 * Provides CRUD operations for managing multiple projects within
 * a single Recurrsive instance. Each project has its own analysis
 * context, findings, and opportunities.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// In-memory project store (no persistence needed — no real users)
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  repository: string;
  language: string;
  framework: string;
  healthScore: number;
  lastAnalysis: string | null;
  createdAt: string;
  updatedAt: string;
  settings: {
    analyzers: string[];
    collectors: string[];
    autoAnalyze: boolean;
    notifyOnCritical: boolean;
  };
}

const projects: Map<string, Project> = new Map();

// Seed default project
const defaultProject: Project = {
  id: generateId(),
  name: 'Recurrsive Platform',
  slug: 'recurrsive',
  description: 'The Recurrsive engineering intelligence platform itself.',
  repository: 'https://github.com/Talomia/Recurrsive',
  language: 'TypeScript',
  framework: 'Node.js + Next.js',
  healthScore: 78,
  lastAnalysis: nowISO(),
  createdAt: '2025-01-15T00:00:00Z',
  updatedAt: nowISO(),
  settings: {
    analyzers: ['architecture', 'ai', 'performance', 'cost', 'reliability', 'security', 'data', 'docs', 'ux', 'product', 'dependency', 'api-contract', 'ai-runtime'],
    collectors: ['git', 'github', 'gitlab', 'docs', 'cicd', 'database', 'environment', 'telemetry', 'cloud-cost', 'error-tracking'],
    autoAnalyze: true,
    notifyOnCritical: true,
  },
};
projects.set(defaultProject.id, defaultProject);

// Seed additional demo projects
const demoProjects: Array<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    name: 'ML Pipeline Service',
    slug: 'ml-pipeline',
    description: 'ML model training and inference pipeline for production workloads.',
    repository: 'https://github.com/Talomia/ml-pipeline',
    language: 'Python',
    framework: 'FastAPI + PyTorch',
    healthScore: 65,
    lastAnalysis: '2026-06-28T14:30:00Z',
    settings: {
      analyzers: ['architecture', 'ai', 'performance', 'security', 'reliability', 'ai-runtime'],
      collectors: ['git', 'github', 'telemetry', 'cloud-cost'],
      autoAnalyze: true,
      notifyOnCritical: true,
    },
  },
  {
    name: 'Customer Portal',
    slug: 'customer-portal',
    description: 'Customer-facing SPA with billing, support, and analytics dashboards.',
    repository: 'https://github.com/Talomia/customer-portal',
    language: 'TypeScript',
    framework: 'React + Vite',
    healthScore: 82,
    lastAnalysis: '2026-06-30T09:15:00Z',
    settings: {
      analyzers: ['architecture', 'performance', 'security', 'ux', 'product', 'dependency', 'api-contract'],
      collectors: ['git', 'github', 'error-tracking'],
      autoAnalyze: false,
      notifyOnCritical: true,
    },
  },
  {
    name: 'Payment Microservice',
    slug: 'payment-service',
    description: 'PCI-compliant payment processing with Stripe and Adyen integration.',
    repository: 'https://github.com/Talomia/payment-service',
    language: 'Go',
    framework: 'Go + gRPC',
    healthScore: 91,
    lastAnalysis: '2026-07-01T02:00:00Z',
    settings: {
      analyzers: ['architecture', 'security', 'reliability', 'data', 'api-contract'],
      collectors: ['git', 'github', 'cicd', 'database', 'cloud-cost'],
      autoAnalyze: true,
      notifyOnCritical: true,
    },
  },
];

for (const p of demoProjects) {
  const id = generateId();
  projects.set(id, {
    ...p,
    id,
    createdAt: '2025-03-01T00:00:00Z',
    updatedAt: nowISO(),
  });
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  // List all projects
  app.get('/api/v1/projects', async (_request, reply) => {
    const list = Array.from(projects.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    return reply.send({
      data: list,
      total: list.length,
    });
  });

  // Get single project
  app.get<{ Params: { id: string } }>('/api/v1/projects/:id', async (request, reply) => {
    const project = projects.get(request.params.id);
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }
    return reply.send({ data: project });
  });

  // Create project
  app.post('/api/v1/projects', async (request, reply) => {
    const body = request.body as Partial<Project>;
    if (!body.name || !body.repository) {
      return reply.status(400).send({ error: 'name and repository are required' });
    }

    const id = generateId();
    const now = nowISO();
    const slug = body.slug ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const project: Project = {
      id,
      name: body.name,
      slug,
      description: body.description ?? '',
      repository: body.repository,
      language: body.language ?? 'Unknown',
      framework: body.framework ?? 'Unknown',
      healthScore: 0,
      lastAnalysis: null,
      createdAt: now,
      updatedAt: now,
      settings: body.settings ?? {
        analyzers: ['architecture', 'ai', 'performance', 'security', 'reliability'],
        collectors: ['git'],
        autoAnalyze: false,
        notifyOnCritical: true,
      },
    };

    projects.set(id, project);
    return reply.status(201).send({ data: project });
  });

  // Update project
  app.put<{ Params: { id: string } }>('/api/v1/projects/:id', async (request, reply) => {
    const project = projects.get(request.params.id);
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const body = request.body as Partial<Project>;
    const updated: Project = {
      ...project,
      name: body.name ?? project.name,
      slug: body.slug ?? project.slug,
      description: body.description ?? project.description,
      repository: body.repository ?? project.repository,
      language: body.language ?? project.language,
      framework: body.framework ?? project.framework,
      settings: body.settings ?? project.settings,
      updatedAt: nowISO(),
    };

    projects.set(updated.id, updated);
    return reply.send({ data: updated });
  });

  // Delete project
  app.delete<{ Params: { id: string } }>('/api/v1/projects/:id', async (request, reply) => {
    if (!projects.has(request.params.id)) {
      return reply.status(404).send({ error: 'Project not found' });
    }
    projects.delete(request.params.id);
    return reply.status(204).send();
  });

  // Get project health comparison (across all projects)
  app.get('/api/v1/projects/compare/health', async (_request, reply) => {
    const comparison = Array.from(projects.values()).map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      healthScore: p.healthScore,
      language: p.language,
      framework: p.framework,
      lastAnalysis: p.lastAnalysis,
    }));

    return reply.send({
      data: comparison.sort((a, b) => b.healthScore - a.healthScore),
      total: comparison.length,
      avgHealth: comparison.length > 0
        ? Math.round(comparison.reduce((s, p) => s + p.healthScore, 0) / comparison.length)
        : 0,
    });
  });
}
