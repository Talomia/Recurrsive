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
  defaultValue: string | boolean;
}

// ─── Data Masking Types ──────────────────────────────────────────────────────

export interface DashboardMaskingPolicy {
  id: string;
  fieldPattern: string;
  piiType: string;
  strategy: 'redact' | 'hash' | 'tokenize' | 'mask' | 'encrypt';
  status: 'active' | 'disabled' | 'testing';
  matchCount: number;
  lastTriggered: string;
}

export interface DashboardPiiDistribution {
  type: string;
  count: number;
  percentage: number;
  color: string;
}

export interface DashboardMaskingStrategy {
  name: string;
  description: string;
  reversible: boolean;
  performanceImpact: 'low' | 'medium' | 'high';
  example: { input: string; output: string };
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get settings sections. Falls back to empty array when server
 * does not have a settings route.
 */
export async function getSettingsSections(): Promise<SettingsSection[]> {
  try {
    return await apiFetch<SettingsSection[]>('/api/v1/settings/sections');
  } catch {
    return [];
  }
}

export async function getMaskingPolicies(): Promise<DashboardMaskingPolicy[]> {
  try {
    return await apiFetch<DashboardMaskingPolicy[]>('/api/v1/data-masking/policies');
  } catch {
    return [];
  }
}

export async function getPiiDistribution(): Promise<DashboardPiiDistribution[]> {
  try {
    return await apiFetch<DashboardPiiDistribution[]>('/api/v1/data-masking/pii-distribution');
  } catch {
    return [];
  }
}

export async function getMaskingStrategies(): Promise<DashboardMaskingStrategy[]> {
  try {
    return await apiFetch<DashboardMaskingStrategy[]>('/api/v1/data-masking/strategies');
  } catch {
    return [];
  }
}
