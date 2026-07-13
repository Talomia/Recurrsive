/**
 * @module Settings API
 *
 * Settings and data masking.
 */

import { apiFetch } from './client';

// ─── Settings Types ──────────────────────────────────────────────────────────

export interface SettingsSection {
  icon: string;
  title: string;
  description: string;
  settings: SettingsField[];
}

export interface SettingsField {
  label: string;
  key: string;
  type: 'toggle' | 'text' | 'password' | 'number';
  defaultValue: string | boolean | number;
}

// ─── Data Masking Types ──────────────────────────────────────────────────────

export interface DashboardMaskingPolicy {
  id: string;
  fieldPattern: string;
  piiType: string;
  strategy: 'redact' | 'hash' | 'partial' | 'tokenize' | 'generalize' | 'suppress';
  enabled: boolean;
  reason: string;
  createdAt: string;
}

export interface DashboardPiiDistribution {
  category: string;
  count: number;
  percentage: number;
}

export interface DashboardMaskingStrategy {
  id: DashboardMaskingPolicy['strategy'];
  name: string;
  description: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export async function getSettingsSections(): Promise<SettingsSection[]> {
  return await apiFetch<SettingsSection[]>('/api/v1/settings/sections');
}

export async function getSettingsValues(): Promise<Record<string, string | boolean | number>> {
  return await apiFetch<Record<string, string | boolean | number>>('/api/v1/settings');
}

export async function getMaskingPolicies(): Promise<DashboardMaskingPolicy[]> {
  return apiFetch<DashboardMaskingPolicy[]>('/api/v1/data-masking/policies');
}

export async function getPiiDistribution(): Promise<DashboardPiiDistribution[]> {
  return apiFetch<DashboardPiiDistribution[]>('/api/v1/data-masking/pii-distribution');
}

export async function getMaskingStrategies(): Promise<DashboardMaskingStrategy[]> {
  return apiFetch<DashboardMaskingStrategy[]>('/api/v1/data-masking/strategies');
}

export async function createMaskingPolicy(
  policy: Omit<DashboardMaskingPolicy, 'id' | 'createdAt'>,
): Promise<DashboardMaskingPolicy> {
  return apiFetch<DashboardMaskingPolicy>('/api/v1/data-masking/policies', {
    method: 'POST',
    body: JSON.stringify(policy),
  });
}

export async function updateMaskingPolicy(
  id: string,
  updates: Partial<Omit<DashboardMaskingPolicy, 'id' | 'createdAt'>>,
): Promise<DashboardMaskingPolicy> {
  return apiFetch<DashboardMaskingPolicy>(`/api/v1/data-masking/policies/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteMaskingPolicy(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/data-masking/policies/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    unwrap: false,
  });
}
