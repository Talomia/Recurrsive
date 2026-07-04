/**
 * @module @recurrsive/server/routes/multi-tenant
 *
 * Multi-tenant deployment model routes.
 *
 * Provides tenant isolation, resource quotas, tenant-scoped data access,
 * and tenant management. Each tenant gets isolated namespaces for
 * projects, findings, and configurations.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';

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
// In-memory store
// ---------------------------------------------------------------------------

const tenants: Map<string, Tenant> = new Map();

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

// Seed demo tenants
const demoTenants: Array<Omit<Tenant, 'id' | 'createdAt' | 'updatedAt' | 'quotas' | 'features'>> = [
  { name: 'Talomia Engineering', slug: 'talomia', tier: 'enterprise', status: 'active', ownerId: 'sarah-chen', customDomain: 'intelligence.talomia.io', usage: { projects: 8, users: 24, analysisRunsToday: 45, storageMB: 12800, collectorsActive: 14, analyzersActive: 13 } },
  { name: 'Acme Startup', slug: 'acme', tier: 'team', status: 'active', ownerId: 'jane-doe', customDomain: null, usage: { projects: 5, users: 12, analysisRunsToday: 15, storageMB: 2100, collectorsActive: 6, analyzersActive: 8 } },
  { name: 'Open Source Project', slug: 'oss-demo', tier: 'free', status: 'trial', ownerId: 'dev-user', customDomain: null, usage: { projects: 2, users: 3, analysisRunsToday: 4, storageMB: 180, collectorsActive: 3, analyzersActive: 5 } },
];

for (const t of demoTenants) {
  const id = generateId();
  tenants.set(id, {
    ...t,
    id,
    quotas: tierQuotas[t.tier],
    features: tierFeatures[t.tier],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: nowISO(),
  });
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerMultiTenantRoutes(app: FastifyInstance): Promise<void> {
  // List all tenants
  app.get('/api/v1/tenants', async (_request, reply) => {
    return reply.send({ data: Array.from(tenants.values()), total: tenants.size });
  });

  // Get tenant details
  app.get<{ Params: { id: string } }>('/api/v1/tenants/:id', async (request, reply) => {
    const tenant = tenants.get(request.params.id);
    if (!tenant) return reply.status(404).send({ error: 'Not Found', message: 'Tenant not found' });
    return reply.send({ data: tenant });
  });

  // Create tenant
  app.post('/api/v1/tenants', async (request, reply) => {
    const body = request.body as { name?: string; slug?: string; tier?: TenantTier; ownerId?: string };
    if (!body.name || !body.slug) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name and slug are required' });
    }

    // Check slug uniqueness
    for (const t of tenants.values()) {
      if (t.slug === body.slug) return reply.status(409).send({ error: 'Conflict', message: 'Slug already taken' });
    }

    const tier = body.tier ?? 'free';
    const id = generateId();
    const now = nowISO();
    const tenant: Tenant = {
      id,
      name: body.name,
      slug: body.slug,
      tier,
      status: tier === 'free' ? 'trial' : 'active',
      ownerId: body.ownerId ?? 'unknown',
      customDomain: null,
      quotas: tierQuotas[tier],
      features: tierFeatures[tier],
      usage: { projects: 0, users: 1, analysisRunsToday: 0, storageMB: 0, collectorsActive: 0, analyzersActive: 0 },
      createdAt: now,
      updatedAt: now,
    };

    tenants.set(id, tenant);
    return reply.status(201).send({ data: tenant });
  });

  // Update tenant
  app.put<{ Params: { id: string } }>('/api/v1/tenants/:id', async (request, reply) => {
    const tenant = tenants.get(request.params.id);
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

    return reply.send({ data: tenant });
  });

  // Delete tenant
  app.delete<{ Params: { id: string } }>('/api/v1/tenants/:id', async (request, reply) => {
    if (!tenants.has(request.params.id)) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tenant not found' });
    }
    tenants.delete(request.params.id);
    return reply.status(204).send();
  });

  // Check quota usage
  app.get<{ Params: { id: string } }>('/api/v1/tenants/:id/quotas', async (request, reply) => {
    const tenant = tenants.get(request.params.id);
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
  app.get('/api/v1/tenants/tiers/info', async (_request, reply) => {
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
