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
