/**
 * @module @recurrsive/server/routes/multi-tenant
 *
 * Tenant management routes (enterprise).
 *
 * Provides CRUD for tenant records — name, tier, status, resource quotas,
 * and owner — plus per-tenant quota/usage reporting. This is tenant
 * *administration*; it does NOT enforce cross-tenant data isolation.
 *
 * Scope of "multi-tenant" today: users are not bound to a tenant (the JWT
 * carries no tenantId) and domain records (projects, findings, configs) are
 * not tagged with a tenant. Recurrsive's core model is a single shared team
 * workspace governed by role-based access control (admin > analyst > viewer):
 * every authenticated user sees the same shared projects and findings, gated
 * by role — not partitioned by tenant. The tenant records managed here are
 * organizational metadata (tiers/quotas/owner), not an isolation boundary.
 *
 * True principal-level tenant isolation (bind each record to a tenant and
 * verify the caller's tenant membership on every read/mutation) first
 * requires modelling user⇄tenant membership, and is intentionally out of
 * scope here — tracked as a dedicated multi-tenancy initiative. Until then,
 * do NOT rely on these routes for data isolation.
 *
 * @packageDocumentation
 */

// SECURITY NOTE(multi-tenant): see the module doc above — tenant records are
// administrative metadata only; they are not an enforced isolation boundary,
// because users have no tenant membership and domain records carry no tenantId.

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { store } from '../store.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TenantTier = 'free' | 'team' | 'enterprise';
type TenantStatus = 'active' | 'suspended' | 'trial' | 'deactivated';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  tier: TenantTier;
  status: TenantStatus;
  /** Owner user ID. */
  ownerId: string;
  /** Custom domain (enterprise tier). */
  customDomain: string | null;
  /** Resource quotas. */
  quotas: {
    maxProjects: number;
    maxUsers: number;
    maxAnalysisRunsPerDay: number;
    maxStorageMB: number;
    maxCollectors: number;
    maxAnalyzers: number;
  };
  /** Current usage. */
  usage: {
    projects: number;
    users: number;
    analysisRunsToday: number;
    storageMB: number;
    collectorsActive: number;
    analyzersActive: number;
  };
  /** Feature flags per tier. */
  features: {
    sso: boolean;
    customBranding: boolean;
    advancedReporting: boolean;
    apiAccess: boolean;
    webhooks: boolean;
    multiRegion: boolean;
    auditLog: boolean;
    dataRetentionDays: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Reference data (read-only)
// ---------------------------------------------------------------------------

// Tier quotas
const tierQuotas: Record<TenantTier, Tenant['quotas']> = {
  free: { maxProjects: 3, maxUsers: 5, maxAnalysisRunsPerDay: 10, maxStorageMB: 500, maxCollectors: 4, maxAnalyzers: 5 },
  team: { maxProjects: 20, maxUsers: 50, maxAnalysisRunsPerDay: 100, maxStorageMB: 5000, maxCollectors: 10, maxAnalyzers: 13 },
  enterprise: { maxProjects: -1, maxUsers: -1, maxAnalysisRunsPerDay: -1, maxStorageMB: 50000, maxCollectors: -1, maxAnalyzers: -1 },
};

const tierFeatures: Record<TenantTier, Tenant['features']> = {
  free: { sso: false, customBranding: false, advancedReporting: false, apiAccess: true, webhooks: false, multiRegion: false, auditLog: false, dataRetentionDays: 30 },
  team: { sso: true, customBranding: false, advancedReporting: true, apiAccess: true, webhooks: true, multiRegion: false, auditLog: true, dataRetentionDays: 90 },
  enterprise: { sso: true, customBranding: true, advancedReporting: true, apiAccess: true, webhooks: true, multiRegion: true, auditLog: true, dataRetentionDays: 365 },
};

// No seed data — tenants are created via the API.

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerMultiTenantRoutes(app: FastifyInstance): Promise<void> {
  // List all tenants
  app.get('/api/v1/tenants', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const all = await store.all<Tenant>('tenants');
    return reply.send({ data: all, total: all.length });
  });

  // Get tenant details
  app.get<{ Params: { id: string } }>('/api/v1/tenants/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const tenant = await store.get<Tenant>('tenants', request.params.id);
    if (!tenant) return reply.status(404).send({ error: 'Not Found', message: 'Tenant not found' });
    return reply.send({ data: tenant });
  });

  // Create tenant
  app.post('/api/v1/tenants', {
    preHandler: [authMiddleware, requireRole('admin')],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'slug'],
        properties: {
          name: { type: 'string', minLength: 1 },
          slug: { type: 'string', minLength: 1 },
          tier: { type: 'string', enum: ['free', 'team', 'enterprise'] },
          plan: { type: 'string' },
          ownerId: { type: 'string' },
        },
        additionalProperties: true,
      },
    },
  }, async (request, reply) => {
    const body = request.body as { name?: string; slug?: string; tier?: TenantTier; plan?: TenantTier; ownerId?: string };
    if (!body.name || !body.slug) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name and slug are required' });
    }

    // Check slug uniqueness — return existing for idempotent E2E runs
    for (const t of await store.all<Tenant>('tenants')) {
      if (t.slug === body.slug) {
        return reply.status(201).send({ data: t });
      }
    }

    const tier = body.tier ?? body.plan ?? 'free';
    const id = generateId();
    const now = nowISO();
    const tenant: Tenant = {
      id,
      name: body.name,
      slug: body.slug,
      tier,
      status: tier === 'free' ? 'trial' : 'active',
      ownerId: body.ownerId ?? (request as typeof request & { user: { id: string } }).user.id,
      customDomain: null,
      quotas: tierQuotas[tier] ?? tierQuotas['free'],
      features: tierFeatures[tier] ?? tierFeatures['free'],
      usage: { projects: 0, users: 1, analysisRunsToday: 0, storageMB: 0, collectorsActive: 0, analyzersActive: 0 },
      createdAt: now,
      updatedAt: now,
    };

    await store.set<Tenant>('tenants', id, tenant);
    return reply.status(201).send({ data: tenant });
  });

  // Update tenant
  app.put<{ Params: { id: string } }>('/api/v1/tenants/:id', {
    preHandler: [authMiddleware, requireRole('admin')],
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          slug: { type: 'string', minLength: 1 },
          tier: { type: 'string', enum: ['free', 'team', 'enterprise'] },
          ownerId: { type: 'string' },
          settings: { type: 'object' },
          status: { type: 'string' },
          customDomain: { type: ['string', 'null'] },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const tenant = await store.get<Tenant>('tenants', request.params.id);
    if (!tenant) return reply.status(404).send({ error: 'Not Found', message: 'Tenant not found' });

    const body = request.body as Partial<Tenant>;
    if (body.name) tenant.name = body.name;
    if (body.tier) {
      tenant.tier = body.tier;
      tenant.quotas = tierQuotas[body.tier];
      tenant.features = tierFeatures[body.tier];
    }
    if (body.status) tenant.status = body.status;
    if (body.customDomain !== undefined) tenant.customDomain = body.customDomain;
    tenant.updatedAt = nowISO();

    await store.set<Tenant>('tenants', request.params.id, tenant);
    return reply.send({ data: tenant });
  });

  // Delete tenant
  app.delete<{ Params: { id: string } }>('/api/v1/tenants/:id', { preHandler: [authMiddleware, requireRole('admin')] }, async (request, reply) => {
    if (!await store.has('tenants', request.params.id)) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tenant not found' });
    }
    await store.delete('tenants', request.params.id);
    return reply.status(204).send();
  });

  // Check quota usage
  app.get<{ Params: { id: string } }>('/api/v1/tenants/:id/quotas', { preHandler: [authMiddleware] }, async (request, reply) => {
    const tenant = await store.get<Tenant>('tenants', request.params.id);
    if (!tenant) return reply.status(404).send({ error: 'Not Found', message: 'Tenant not found' });

    const checks = Object.entries(tenant.quotas).map(([key, limit]) => {
      const usageKey = key.replace('max', '').charAt(0).toLowerCase() + key.replace('max', '').slice(1);
      const current = (tenant.usage as Record<string, number>)[usageKey] ?? 0;
      const unlimited = limit === -1;
      return {
        resource: key,
        limit: unlimited ? 'unlimited' : limit,
        current,
        remaining: unlimited ? 'unlimited' : Math.max(0, limit - current),
        utilization: unlimited ? 0 : Math.round((current / limit) * 100),
        atRisk: !unlimited && current >= limit * 0.8,
      };
    });

    return reply.send({
      data: {
        tenant: { id: tenant.id, name: tenant.name, tier: tenant.tier },
        quotas: checks,
        overallUtilization: Math.round(
          checks.filter(c => typeof c.utilization === 'number').reduce((s, c) => s + (c.utilization as number), 0) /
          checks.filter(c => typeof c.utilization === 'number').length,
        ),
      },
    });
  });

  // Get available tiers and pricing
  app.get('/api/v1/tenants/tiers/info', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.send({
      data: {
        tiers: [
          { tier: 'free', price: '$0/mo', quotas: tierQuotas.free, features: tierFeatures.free },
          { tier: 'team', price: '$49/mo per user', quotas: tierQuotas.team, features: tierFeatures.team },
          { tier: 'enterprise', price: 'Custom', quotas: tierQuotas.enterprise, features: tierFeatures.enterprise },
        ],
      },
    });
  });
}
