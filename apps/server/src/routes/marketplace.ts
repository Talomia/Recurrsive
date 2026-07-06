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
 * Data is persisted via ServerStore.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';
import { store } from '../store.js';
import { authMiddleware } from '../middleware/auth.js';

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

// No seed data — extensions are created by the user via the API.

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
  app.get(`${prefix}/extensions`, { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = request.query as {
      category?: ExtensionCategory;
      source?: ExtensionSource;
      search?: string;
      sort?: 'downloads' | 'rating' | 'name' | 'newest';
      limit?: string;
      offset?: string;
    };

    let results = (await store.all<MarketplaceExtension>('extensions'))
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
  app.get(`${prefix}/extensions/:id`, { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ext = await store.get<MarketplaceExtension>('extensions', id);
    if (!ext) {
      return reply.status(404).send({ error: 'Not Found', message: 'Extension not found' });
    }
    return reply.send({ data: ext });
  });

  /**
   * POST /api/v1/marketplace/extensions
   *
   * Submit a new extension for review.
   */
  app.post(`${prefix}/extensions`, {
    preHandler: [authMiddleware],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'category', 'description', 'repositoryUrl'],
        properties: {
          name: { type: 'string', minLength: 1 },
          category: { type: 'string', minLength: 1 },
          description: { type: 'string', minLength: 1 },
          repositoryUrl: { type: 'string', minLength: 1 },
          author: { type: 'string' },
          version: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          license: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const body = request.body as ExtensionSubmission;

    if (!body.name || !body.category || !body.description || !body.repositoryUrl) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing required fields: name, category, description, repositoryUrl',
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

    await store.set<MarketplaceExtension>('extensions', id, ext);

    return reply.status(201).send({ data: ext, message: 'Extension submitted for review' });
  });

  /**
   * GET /api/v1/marketplace/categories
   *
   * List available categories with counts.
   */
  app.get(`${prefix}/categories`, { preHandler: [authMiddleware] }, async (_request, reply) => {
    const all = (await store.all<MarketplaceExtension>('extensions')).filter((e) => e.status === 'published');
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
  app.get(`${prefix}/stats`, { preHandler: [authMiddleware] }, async (_request, reply) => {
    const all = await store.all<MarketplaceExtension>('extensions');
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
