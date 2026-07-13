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
  description: string;
  backend: 'local';
  version: number;
  tags: string[];
  createdBy: string;
  lastRotated: string | null;
  rotationIntervalDays: number;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardAuditEntry {
  id: string;
  secretKey: string;
  action: 'rotated' | 'created' | 'read' | 'updated' | 'deleted';
  actor: string;
  timestamp: string;
}

// ─── SSO Types ───────────────────────────────────────────────────────────────

export interface SSOProvider {
  id: string;
  provider: 'okta' | 'auth0' | 'azure-ad' | 'google-workspace' | 'custom';
  displayName: string;
  idpEntityId: string;
  spEntityId: string;
  ssoUrl: string;
  autoProvision: boolean;
  defaultRole: 'admin' | 'analyst' | 'viewer';
  createdAt: string;
}

export interface SSOProviderConfig {
  provider: SSOProvider['provider'];
  displayName: string;
  idpEntityId: string;
  spEntityId: string;
  ssoUrl: string;
  certificate: string;
  signatureMode: 'both' | 'response' | 'assertion' | 'either';
  allowedDomains: string[];
  attributeMapping?: Record<string, string>;
  groupRoleMapping?: Record<string, 'admin' | 'analyst' | 'viewer'>;
  autoProvision: boolean;
  defaultRole: SSOProvider['defaultRole'];
  createdAt?: string;
  updatedAt?: string;
}

export interface SSOSession {
  sessionId: string;
  userId: string;
  email: string;
  provider: string;
  createdAt: string;
  expiresAt: string;
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

export async function getSSOProvider(id: string): Promise<SSOProviderConfig> {
  return apiFetch<SSOProviderConfig>(`/api/v1/sso/providers/${encodeURIComponent(id)}`);
}

export async function createSsoProvider(id: string, data: SSOProviderConfig): Promise<SSOProviderConfig> {
  return await apiFetch<SSOProviderConfig>(`/api/v1/sso/providers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function getSSOMetadataUrl(id: string): string {
  return `/api/v1/sso/providers/${encodeURIComponent(id)}/metadata`;
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

export async function createSecret(data: { key: string; value: string; description?: string; tags?: string[]; rotationIntervalDays?: number }): Promise<DashboardSecret> {
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

export async function rotateSecret(id: string, newValue: string): Promise<DashboardSecret> {
  return await apiFetch<DashboardSecret>(`/api/v1/secrets/${encodeURIComponent(id)}/rotate`, {
    method: 'POST',
    body: JSON.stringify({ newValue }),
  });
}
