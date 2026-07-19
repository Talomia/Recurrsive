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
  /** Average user rating (0–5) as recorded by the server. */
  rating: number;
  downloads: number;
  type: 'analyzer' | 'collector' | 'reporter' | 'integration';
  verified: boolean;
}

// ─── Cloud Types ─────────────────────────────────────────────────────────────

/**
 * Aggregated benchmark report as returned by `GET /cloud/benchmarks/report`.
 * `percentiles` is null when the sample is too small for meaningful stats.
 */
export interface CloudBenchmarkReport {
  industry: string;
  sampleSize: number;
  percentiles: { p25: number; p50: number; p75: number; p90: number } | null;
  percentilesNote?: string;
  dimensionAverages: Record<string, number>;
  topImprovementAreas: string[];
}

/** Learned pattern as stored by the server (`LearnedPattern`). */
export interface CloudLearnedPattern {
  id: string;
  name: string;
  category: string;
  occurrences: number;
  successRate: number;
  /** Average health score improvement when addressed. */
  avgImpact: number;
  recommendation: string;
  confidence: number;
}

/** Cloud partner integration entry as stored by the server (`CloudPartner`). */
export interface CloudPartner {
  id: string;
  name: string;
  type: string;
  status: string;
  integration_level: string;
  supported_services: string[];
}

/** Managed service tier as returned by the server (`ManagedService`). */
export interface CloudServiceTier {
  id: string;
  name: string;
  description: string;
  tier: string;
  features: string[];
  priceRange: string;
  sla: string;
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

/** Get installed plugins. Throws on failure. */
export async function getInstalledPlugins(): Promise<InstalledPlugin[]> {
  return await apiFetch<InstalledPlugin[]>('/api/v1/plugins/installed');
}

/** Get marketplace plugins. Throws on failure. */
export async function getMarketplacePlugins(): Promise<MarketplacePlugin[]> {
  return await apiFetch<MarketplacePlugin[]>('/api/v1/plugins/marketplace');
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

/**
 * Get the aggregated benchmark report from `GET /cloud/benchmarks/report`.
 *
 * The server returns a single report OBJECT (not an array). When no benchmark
 * data has been submitted it answers `{ message, sampleSize: 0 }` — that case
 * is returned as null (a genuine empty state). Throws on failure.
 */
export async function getCloudBenchmarkReport(): Promise<CloudBenchmarkReport | null> {
  const result = await apiFetch<CloudBenchmarkReport | { message?: string; sampleSize: number }>(
    '/api/v1/cloud/benchmarks/report',
  );
  if (!result || result.sampleSize === 0 || !('dimensionAverages' in result)) {
    return null;
  }
  return result;
}

/** Get cross-org learned patterns. Throws on failure. */
export async function getCloudPatterns(): Promise<CloudLearnedPattern[]> {
  const result = await apiFetch<CloudLearnedPattern[]>('/api/v1/cloud/patterns');
  return Array.isArray(result) ? result : [];
}

/** Get cloud partner integrations. Throws on failure. */
export async function getCloudPartners(): Promise<CloudPartner[]> {
  const result = await apiFetch<CloudPartner[]>('/api/v1/cloud/partners');
  return Array.isArray(result) ? result : [];
}

/** Get the managed services catalog. Throws on failure. */
export async function getCloudServices(): Promise<CloudServiceTier[]> {
  const result = await apiFetch<CloudServiceTier[]>('/api/v1/cloud/services');
  return Array.isArray(result) ? result : [];
}

// ─── Secrets API ─────────────────────────────────────────────────────────────

/** Get stored secrets metadata. Throws on failure. */
export async function getSecrets(): Promise<DashboardSecret[]> {
  return await apiFetch<DashboardSecret[]>('/api/v1/secrets');
}

/** Get the secrets audit log. Throws on failure. */
export async function getSecretAuditLog(): Promise<DashboardAuditEntry[]> {
  return await apiFetch<DashboardAuditEntry[]>('/api/v1/secrets/audit/log');
}

// ─── SSO API ─────────────────────────────────────────────────────────────────

/** Get SSO providers. Throws on failure. */
export async function getSSOProviders(): Promise<SSOProvider[]> {
  return await apiFetch<SSOProvider[]>('/api/v1/sso/providers');
}

/** Get active SSO sessions. Throws on failure. */
export async function getSSOSessions(): Promise<SSOSession[]> {
  return await apiFetch<SSOSession[]>('/api/v1/sso/sessions');
}

// ─── Tenants API ─────────────────────────────────────────────────────────────

/** Get tenants. Throws on failure. */
export async function getTenants(): Promise<DashboardTenant[]> {
  return await apiFetch<DashboardTenant[]>('/api/v1/tenants');
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

/** Get intelligence packs. Throws on failure. */
export async function getIntelligencePacks(): Promise<DashboardIntelligencePack[]> {
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
}

// ─── Marketplace API ─────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any -- marketplace uses unstructured objects */

export async function getMarketplaceExtensions(params?: { category?: string; search?: string; sort?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sort) searchParams.set('sort', params.sort);
  const query = searchParams.toString();
  return await apiFetch<{ data: any[]; total: number; categories: Record<string, number> }>(
    `/api/v1/marketplace/extensions${query ? `?${query}` : ''}`,
    { unwrap: false },
  );
}

export async function getMarketplaceStats() {
  return await apiFetch<{ data: any }>('/api/v1/marketplace/stats', { unwrap: false });
}

export async function getMarketplaceCategories() {
  return await apiFetch<{ data: any[] }>('/api/v1/marketplace/categories', { unwrap: false });
}

// ─── Partners API ────────────────────────────────────────────────────────────

export async function getPartners(params?: { tier?: string; type?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.tier) searchParams.set('tier', params.tier);
  if (params?.type) searchParams.set('type', params.type);
  const query = searchParams.toString();
  const res = await apiFetch<{ data: any[]; total: number; tierCounts: Record<string, number> }>(
    `/api/v1/partners${query ? `?${query}` : ''}`,
    { unwrap: false },
  );
  const mappedData = (res.data ?? []).map((partner: any) => {
    // Map server type to emoji logo
    const typeToLogo: Record<string, string> = {
      'system-integrator': '🏢',
      'consulting': '🤝',
      'technology': '🔌',
      'cloud-provider': '☁️',
    };
    return {
      id: partner.id,
      name: partner.name,
      tier: partner.tier,
      specialty: partner.specializations?.join(', ') || partner.type || 'General Integration',
      logo: typeToLogo[partner.type] || '💼',
      projects: partner.customerCount ?? partner.certifiedEngineers ?? 0,
      description: partner.description || '',
    };
  });
  return { data: mappedData, total: res.total ?? mappedData.length, tierCounts: res.tierCounts ?? {} };
}

export async function getPartnerCertifications() {
  const res = await apiFetch<{ data: any[] }>('/api/v1/partners/certifications', { unwrap: false });
  const mappedData = (res.data ?? []).map((cert: any) => {
    return {
      id: cert.id,
      name: cert.name,
      level: cert.level,
      // Honest fallbacks — never an invented "2 hours" / "4 modules".
      duration: cert.examDuration || cert.validityPeriod || '—',
      modules: cert.requirements?.length ?? 0,
      enrolled: cert.enrolledCount ?? 0,
    };
  });
  return { data: mappedData };
}

export async function getPartnerStats() {
  return await apiFetch<{ data: any }>('/api/v1/partners/stats', { unwrap: false });
}
