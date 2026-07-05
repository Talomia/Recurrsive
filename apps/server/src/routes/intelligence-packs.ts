/**
 * @module @recurrsive/server/routes/intelligence-packs
 *
 * Domain intelligence pack routes.
 *
 * Provides:
 * - Browsing available intelligence packs
 * - Installing / uninstalling packs for vertical-specific analysis
 *
 * Data is persisted via ServerStore.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { store } from '../store.js';

// ---------------------------------------------------------------------------
// Types
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
// Route registration
// ---------------------------------------------------------------------------

export async function registerIntelligencePackRoutes(app: FastifyInstance): Promise<void> {
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
