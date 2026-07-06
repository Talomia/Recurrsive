/**
 * @module @recurrsive/server/routes/ecosystem
 *
 * Ecosystem overview and integration management routes.
 *
 * Provides endpoints for inspecting the ecosystem of integrations,
 * plugins, and connected services.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { createLogger, nowISO } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';
import { store } from '../store.js';

const logger = createLogger({ context: { component: 'server:routes:ecosystem' } });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Integration {
  id: string;
  name: string;
  category: string;
  description: string;
  status: 'active' | 'inactive' | 'pending';
  version: string;
  configured: boolean;
  config_hint?: string;
}

// ---------------------------------------------------------------------------
// Built-in integrations catalog (static)
// ---------------------------------------------------------------------------

const builtInIntegrations: Integration[] = [
  {
    id: 'int-git',
    name: 'Git Repository',
    category: 'source_control',
    description: 'Collect repository structure, history, and metadata from Git repositories.',
    status: 'active',
    version: '1.0.0',
    configured: true,
  },
  {
    id: 'int-github',
    name: 'GitHub',
    category: 'source_control',
    description: 'GitHub API integration for pull requests, issues, and CI status.',
    status: 'inactive',
    version: '1.0.0',
    configured: false,
    config_hint: 'Set GITHUB_TOKEN environment variable.',
  },
  {
    id: 'int-slack',
    name: 'Slack',
    category: 'notifications',
    description: 'Send analysis notifications and alerts to Slack channels.',
    status: !!process.env['SLACK_WEBHOOK_URL'] ? 'active' : 'inactive',
    version: '1.0.0',
    configured: !!process.env['SLACK_WEBHOOK_URL'],
    config_hint: 'Set SLACK_WEBHOOK_URL environment variable.',
  },
  {
    id: 'int-webhook',
    name: 'Webhooks',
    category: 'notifications',
    description: 'Generic webhook delivery for analysis events.',
    status: 'active',
    version: '1.0.0',
    configured: true,
  },
  {
    id: 'int-openai',
    name: 'OpenAI',
    category: 'ai',
    description: 'GPT-powered reasoning engine for multi-agent analysis.',
    status: !!process.env['RECURRSIVE_LLM_API_KEY'] ? 'active' : 'inactive',
    version: '1.0.0',
    configured: !!process.env['RECURRSIVE_LLM_API_KEY'],
    config_hint: 'Set RECURRSIVE_LLM_API_KEY environment variable.',
  },
  {
    id: 'int-sso',
    name: 'SSO / SAML',
    category: 'auth',
    description: 'Single sign-on via SAML 2.0 for enterprise authentication.',
    status: process.env['ENABLE_ENTERPRISE'] !== 'false' ? 'active' : 'inactive',
    version: '1.0.0',
    configured: process.env['ENABLE_ENTERPRISE'] !== 'false',
  },
  {
    id: 'int-postgres',
    name: 'PostgreSQL + AGE',
    category: 'database',
    description: 'Apache AGE graph database on PostgreSQL for large-scale analysis.',
    status: !!process.env['DATABASE_URL'] ? 'active' : 'inactive',
    version: '1.0.0',
    configured: !!process.env['DATABASE_URL'],
    config_hint: 'Set DATABASE_URL and GRAPH_PROVIDER=postgresql_age.',
  },
];

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register ecosystem overview and integration routes.
 *
 * @param app - Fastify instance.
 */
export async function registerEcosystemRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/ecosystem/overview
   *
   * Return a high-level overview of the ecosystem including
   * integration counts, health status, and feature availability.
   */
  app.get('/api/v1/ecosystem/overview', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const integrations = builtInIntegrations;
    const activeCount = integrations.filter(i => i.status === 'active').length;
    const totalCount = integrations.length;

    // Count plugins from store
    const pluginCount = await store.count('plugins');

    // Group by category
    const byCategory: Record<string, number> = {};
    for (const integration of integrations) {
      byCategory[integration.category] = (byCategory[integration.category] ?? 0) + 1;
    }

    logger.debug(`Ecosystem overview: ${activeCount}/${totalCount} integrations active`);

    return reply.status(200).send({
      data: {
        health: activeCount >= totalCount * 0.5 ? 'healthy' : 'degraded',
        integrations: {
          total: totalCount,
          active: activeCount,
          inactive: totalCount - activeCount,
          by_category: byCategory,
        },
        plugins: {
          total: pluginCount,
        },
        features: {
          enterprise: process.env['ENABLE_ENTERPRISE'] !== 'false',
          ecosystem: process.env['ENABLE_ECOSYSTEM'] !== 'false',
          reasoning: !!process.env['RECURRSIVE_LLM_API_KEY'],
          graph_database: !!process.env['DATABASE_URL'],
        },
      },
      generatedAt: nowISO(),
    });
  });

  /**
   * GET /api/v1/ecosystem/integrations
   *
   * Return the full list of available integrations with their
   * configuration status.
   *
   * Query params:
   * - category: filter by category (source_control, notifications, ai, auth, database)
   * - status: filter by status (active, inactive, pending)
   */
  app.get<{ Querystring: { category?: string; status?: string } }>(
    '/api/v1/ecosystem/integrations',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      let integrations: Integration[] = [...builtInIntegrations];

      if (request.query.category) {
        integrations = integrations.filter(i => i.category === request.query.category);
      }

      if (request.query.status) {
        integrations = integrations.filter(i => i.status === request.query.status);
      }

      return reply.status(200).send({
        data: integrations,
        total: integrations.length,
      });
    },
  );
}
