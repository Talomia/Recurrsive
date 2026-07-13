/**
 * @module Platform API
 *
 * Self-hosted services, secrets, and SSO.
 */

import { apiFetch } from './client';

export interface CloudServiceTier {
  id: string;
  name: string;
  description: string;
  tier: string;
  priceRange: string;
  features: string[];
  availability: string;
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

export async function getCloudServices(): Promise<CloudServiceTier[]> {
  const result = await apiFetch<CloudServiceTier[] | Record<string, unknown>>('/api/v1/cloud/services');
  return Array.isArray(result) ? result : [];
}

// ─── Secrets API ─────────────────────────────────────────────────────────────

export async function getSecrets(): Promise<DashboardSecret[]> {
  return apiFetch<DashboardSecret[]>('/api/v1/secrets');
}

export async function getSecretAuditLog(): Promise<DashboardAuditEntry[]> {
  return apiFetch<DashboardAuditEntry[]>('/api/v1/secrets/audit/log');
}

// ─── SSO API ─────────────────────────────────────────────────────────────────

export async function getSSOProviders(): Promise<SSOProvider[]> {
  return apiFetch<SSOProvider[]>('/api/v1/sso/providers');
}

export async function getSSOSessions(): Promise<SSOSession[]> {
  return apiFetch<SSOSession[]>('/api/v1/sso/sessions');
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
