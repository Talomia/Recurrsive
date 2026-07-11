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

const FALLBACK_SECTIONS: SettingsSection[] = [
  {
    icon: 'Globe',
    title: 'General Settings',
    description: 'Configure general dashboard parameters and analytical operations.',
    settings: [
      { label: 'Analytics Region', key: 'analytics_region', type: 'text', defaultValue: 'US-East' },
      { label: 'Enable Telemetry Reporting', key: 'enable_telemetry', type: 'toggle', defaultValue: true },
    ],
  },
  {
    icon: 'Bell',
    title: 'Notification Preferences',
    description: 'Manage how and when you receive automated vulnerability alerts.',
    settings: [
      { label: 'Notify on Analysis Failures', key: 'notify_on_failures', type: 'toggle', defaultValue: true },
      { label: 'Notify on Non-blocking Warnings', key: 'notify_on_warnings', type: 'toggle', defaultValue: false },
      { label: 'Notification Alert Email', key: 'notification_email', type: 'text', defaultValue: 'admin@company.com' },
    ],
  },
  {
    icon: 'Shield',
    title: 'Security & Masking Settings',
    description: 'Configure multi-factor policies and data mask compliance.',
    settings: [
      { label: 'Enforce PII Data Masking', key: 'data_masking_active', type: 'toggle', defaultValue: true },
      { label: 'Require MFA for Administrators', key: 'enforce_mfa', type: 'toggle', defaultValue: false },
    ],
  },
  {
    icon: 'Palette',
    title: 'Aesthetics & Workspace Style',
    description: 'Manage the look and feel of the Recurrsive administration client.',
    settings: [
      { label: 'Dark Theme Focus', key: 'dark_mode_theme', type: 'toggle', defaultValue: true },
    ],
  },
];

/**
 * Get settings sections. Falls back to default client settings when server
 * does not have a settings route.
 */
export async function getSettingsSections(): Promise<SettingsSection[]> {
  try {
    const res = await apiFetch<SettingsSection[]>('/api/v1/settings/sections');
    if (!res || res.length === 0) {
      return FALLBACK_SECTIONS;
    }
    return res;
  } catch {
    return FALLBACK_SECTIONS;
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
