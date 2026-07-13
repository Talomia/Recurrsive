import type { FastifyInstance } from 'fastify';
import { store } from '../store.js';

export const TEST_PROJECT_ID = 'test-project';

const TEST_SETTINGS = {
  analyzers: [
    'architecture.structural',
    'ai.quality',
    'performance.general',
    'cost.optimization',
    'reliability.resilience',
    'security.vulnerabilities',
    'data.schema-quality',
    'docs.completeness',
    'ux.quality',
    'product.health',
    'dependency.vulnerabilities',
    'api-contract.quality',
    'ai.runtime',
  ],
  collectors: ['git', 'documentation', 'environment', 'cicd', 'database'],
};

export async function seedTestProject(projectId = TEST_PROJECT_ID): Promise<void> {
  const timestamp = '2024-06-15T00:00:00.000Z';
  await store.set('projects', projectId, {
    id: projectId,
    name: 'Test Project',
    slug: projectId,
    description: 'Project-scoped test fixture',
    repository: '/tmp/recurrsive-repos/test-project',
    language: 'TypeScript',
    framework: 'Fastify',
    healthScore: 0,
    lastAnalysis: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    settings: TEST_SETTINGS,
  });
}

export function projectScopedUrl(url: string, projectId = TEST_PROJECT_ID): string {
  if (new URL(url, 'http://localhost').searchParams.has('projectId')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}projectId=${encodeURIComponent(projectId)}`;
}

interface TestInjectOptions {
  url: string;
  method?: 'DELETE' | 'GET' | 'HEAD' | 'OPTIONS' | 'PATCH' | 'POST' | 'PUT';
  headers?: Record<string, string>;
  payload?: object | string;
}

/** Apply explicit project scope to every fixture request in legacy broad route suites. */
export function installProjectScopedInjection(app: FastifyInstance, projectId = TEST_PROJECT_ID): void {
  const originalInject = app.inject.bind(app) as (options: TestInjectOptions) => ReturnType<FastifyInstance['inject']>;
  const scopedInject = (options: TestInjectOptions) => originalInject({
    ...options,
    url: projectScopedUrl(options.url, projectId),
  });
  app.inject = scopedInject as FastifyInstance['inject'];
}
