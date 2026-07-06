/**
 * @module Platform API
 *
 * Plugins, cloud, secrets, SSO, tenants, and intelligence packs.
 */

import { apiFetch } from './client';

// ─── Plugin Types ────────────────────────────────────────────────────────────

export interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  enabled: boolean;
  health: 'healthy' | 'degraded' | 'error';
  type: 'analyzer' | 'collector' | 'reporter' | 'integration';
  installedAt: string;
}

export interface MarketplacePlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  stars: number;
  downloads: number;
  type: 'analyzer' | 'collector' | 'reporter' | 'integration';
  verified: boolean;
}

// ─── Cloud Types ─────────────────────────────────────────────────────────────

export interface CloudBenchmark {
  dimension: string;
  yourScore: number;
  p50: number;
  p75: number;
  p90: number;
  percentile: number;
}

export interface CloudLearnedPattern {
  id: string;
  name: string;
  category: string;
  occurrences: number;
  successRate: number;
  lastSeen: string;
}

export interface CloudPartner {
  id: string;
  name: string;
  tier: 'platinum' | 'gold' | 'silver';
  specialty: string;
  projects: number;
  logo: string;
}

export interface CloudServiceTier {
  name: string;
  price: string;
  features: string[];
  highlighted: boolean;
}

// ─── Secrets Types ───────────────────────────────────────────────────────────

export interface DashboardSecret {
  id: string;
  key: string;
  backend: 'vault' | 'aws' | 'azure' | 'local';
  version: number;
  createdAt: string;
  lastRotated: string;
  rotationDays: number;
  maxAgeDays: number;
  status: 'current' | 'expiring' | 'needs_rotation';
  usedBy: string[];
}

export interface DashboardAuditEntry {
  id: string;
  secretKey: string;
  action: 'rotated' | 'created' | 'accessed' | 'deleted';
  actor: string;
  timestamp: string;
}

// ─── SSO Types ───────────────────────────────────────────────────────────────

export interface SSOProvider {
  id: string;
  name: string;
  type: 'okta' | 'auth0' | 'azure_ad' | 'google';
  status: 'configured' | 'pending' | 'error';
  domain: string;
  protocol: 'SAML' | 'OIDC';
  usersCount: number;
  lastSync: string;
}

export interface SSOSession {
  id: string;
  user: string;
  email: string;
  provider: string;
  ip: string;
  loginAt: string;
  expiresAt: string;
  active: boolean;
}

// ─── Tenant Types ────────────────────────────────────────────────────────────

export interface DashboardTenant {
  id: string;
  name: string;
  slug: string;
  tier: 'free' | 'team' | 'enterprise';
  status: 'active' | 'suspended' | 'trial';
  createdAt: string;
  owner: string;
  quotas: {
    projects: { used: number; max: number };
    users: { used: number; max: number };
    storageMb: { used: number; max: number };
  };
}

// ─── Intelligence Pack Types ─────────────────────────────────────────────────

export interface DashboardAnalyzer {
  name: string;
  description: string;
  ruleCount: number;
}

export interface DashboardIntelligencePack {
  id: string;
  name: string;
  domain: string;
  icon: string;
  version: string;
  status: 'installed' | 'available' | 'updating';
  description: string;
  analyzers: DashboardAnalyzer[];
  frameworks: string[];
  entityTypes: string[];
  totalRules: number;
  lastUpdated: string;
}

// ─── Plugin API ──────────────────────────────────────────────────────────────

export async function getInstalledPlugins(): Promise<InstalledPlugin[]> {
  try {
    return await apiFetch<InstalledPlugin[]>('/api/v1/plugins/installed');
  } catch {
    return [];
  }
}

export async function getMarketplacePlugins(): Promise<MarketplacePlugin[]> {
  try {
    return await apiFetch<MarketplacePlugin[]>('/api/v1/plugins/marketplace');
  } catch {
    return [];
  }
}

export async function installPlugin(id: string): Promise<InstalledPlugin> {
  return await apiFetch<InstalledPlugin>(`/api/v1/plugins/install/${encodeURIComponent(id)}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function uninstallPlugin(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/plugins/installed/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    unwrap: false,
  });
}

export async function togglePlugin(id: string): Promise<InstalledPlugin> {
  return await apiFetch<InstalledPlugin>(`/api/v1/plugins/installed/${encodeURIComponent(id)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// ─── Cloud API ───────────────────────────────────────────────────────────────

export async function getCloudBenchmarks(): Promise<CloudBenchmark[]> {
  try {
    return await apiFetch<CloudBenchmark[]>('/api/v1/cloud/benchmarks/report');
  } catch {
    return [];
  }
}

export async function getCloudPatterns(): Promise<CloudLearnedPattern[]> {
  try {
    return await apiFetch<CloudLearnedPattern[]>('/api/v1/cloud/patterns');
  } catch {
    return [];
  }
}

export async function getCloudPartners(): Promise<CloudPartner[]> {
  try {
    return await apiFetch<CloudPartner[]>('/api/v1/cloud/partners');
  } catch {
    return [];
  }
}

export async function getCloudServices(): Promise<CloudServiceTier[]> {
  try {
    return await apiFetch<CloudServiceTier[]>('/api/v1/cloud/services');
  } catch {
    return [];
  }
}

// ─── Secrets API ─────────────────────────────────────────────────────────────

export async function getSecrets(): Promise<DashboardSecret[]> {
  try {
    return await apiFetch<DashboardSecret[]>('/api/v1/secrets');
  } catch {
    return [];
  }
}

export async function getSecretAuditLog(): Promise<DashboardAuditEntry[]> {
  try {
    return await apiFetch<DashboardAuditEntry[]>('/api/v1/secrets/audit/log');
  } catch {
    return [];
  }
}

// ─── SSO API ─────────────────────────────────────────────────────────────────

export async function getSSOProviders(): Promise<SSOProvider[]> {
  try {
    return await apiFetch<SSOProvider[]>('/api/v1/sso/providers');
  } catch {
    return [];
  }
}

export async function getSSOSessions(): Promise<SSOSession[]> {
  try {
    return await apiFetch<SSOSession[]>('/api/v1/sso/sessions');
  } catch {
    return [];
  }
}

// ─── Tenants API ─────────────────────────────────────────────────────────────

export async function getTenants(): Promise<DashboardTenant[]> {
  try {
    return await apiFetch<DashboardTenant[]>('/api/v1/tenants');
  } catch {
    return [];
  }
}

export async function createTenant(data: { name: string; slug: string; tier: string }): Promise<DashboardTenant> {
  return await apiFetch<DashboardTenant>('/api/v1/tenants', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteTenant(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/tenants/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    unwrap: false,
  });
}

// ─── SSO Mutations ───────────────────────────────────────────────────────────

export async function createSsoProvider(id: string, data: { provider: string; displayName: string; entityId?: string; ssoUrl?: string }): Promise<SSOProvider> {
  return await apiFetch<SSOProvider>(`/api/v1/sso/providers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSsoProvider(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/sso/providers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    unwrap: false,
  });
}

export async function revokeSsoSession(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/sso/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    unwrap: false,
  });
}

// ─── Secrets Mutations ───────────────────────────────────────────────────────

export async function createSecret(data: { key: string; value: string; description?: string; tags?: string[] }): Promise<DashboardSecret> {
  return await apiFetch<DashboardSecret>('/api/v1/secrets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteSecret(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/secrets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    unwrap: false,
  });
}

export async function rotateSecret(id: string): Promise<DashboardSecret> {
  return await apiFetch<DashboardSecret>(`/api/v1/secrets/${encodeURIComponent(id)}/rotate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// ─── Intelligence Packs API ──────────────────────────────────────────────────

/** Server-side intelligence pack shape (differs from DashboardIntelligencePack). */
interface ServerIntelligencePack {
  id: string;
  name: string;
  domain: string;
  version: string;
  description: string;
  analyzers: string[];
  frameworks: string[];
  entityTypes: string[];
  ruleCount: number;
  status: 'available' | 'installed' | 'updating';
  author: string;
}

/** Derive a Lucide icon name from the pack's domain. */
const DOMAIN_ICON_MAP: Record<string, string> = {
  fintech: 'banknote',
  healthcare: 'heart-pulse',
  security: 'shield',
  'e-commerce': 'shopping-cart',
  infrastructure: 'server',
  compliance: 'file-check',
  devops: 'git-branch',
  analytics: 'bar-chart',
};

export async function getIntelligencePacks(): Promise<DashboardIntelligencePack[]> {
  try {
    const res = await apiFetch<{ data: ServerIntelligencePack[]; total: number }>(
      '/api/v1/intelligence-packs',
      { unwrap: false },
    );
    const packs = res.data ?? [];
    return packs.map((pack) => {
      // Distribute ruleCount evenly across analyzers
      const analyzerCount = pack.analyzers.length || 1;
      const perAnalyzer = Math.round(pack.ruleCount / analyzerCount);
      const analyzers: DashboardAnalyzer[] = pack.analyzers.map((name) => ({
        name,
        description: `${pack.domain} analyzer`,
        ruleCount: perAnalyzer,
      }));
      return {
        id: pack.id,
        name: pack.name,
        domain: pack.domain,
        icon: DOMAIN_ICON_MAP[pack.domain.toLowerCase()] ?? 'brain',
        version: pack.version,
        status: pack.status,
        description: pack.description,
        analyzers,
        frameworks: pack.frameworks,
        entityTypes: pack.entityTypes,
        totalRules: pack.ruleCount,
        lastUpdated: new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}

// ─── Marketplace API ─────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any -- marketplace uses unstructured objects */

export async function getMarketplaceExtensions(params?: { category?: string; search?: string; sort?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sort) searchParams.set('sort', params.sort);
  const query = searchParams.toString();
  try {
    return await apiFetch<{ data: any[]; total: number; categories: Record<string, number> }>(
      `/api/v1/marketplace/extensions${query ? `?${query}` : ''}`,
    );
  } catch {
    return { data: [], total: 0, categories: {} };
  }
}

export async function getMarketplaceStats() {
  try {
    return await apiFetch<{ data: any }>('/api/v1/marketplace/stats');
  } catch {
    return { data: {} };
  }
}

export async function getMarketplaceCategories() {
  try {
    return await apiFetch<{ data: any[] }>('/api/v1/marketplace/categories');
  } catch {
    return { data: [] };
  }
}

// ─── Partners API ────────────────────────────────────────────────────────────

export async function getPartners(params?: { tier?: string; type?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.tier) searchParams.set('tier', params.tier);
  if (params?.type) searchParams.set('type', params.type);
  const query = searchParams.toString();
  try {
    return await apiFetch<{ data: any[]; total: number; tierCounts: Record<string, number> }>(
      `/api/v1/partners${query ? `?${query}` : ''}`,
    );
  } catch {
    return { data: [], total: 0, tierCounts: {} };
  }
}

export async function getPartnerCertifications() {
  try {
    return await apiFetch<{ data: any[] }>('/api/v1/partners/certifications');
  } catch {
    return { data: [] };
  }
}

export async function getPartnerStats() {
  try {
    return await apiFetch<{ data: any }>('/api/v1/partners/stats');
  } catch {
    return { data: {} };
  }
}
