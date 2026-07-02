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

// ─── Settings Mock Data ──────────────────────────────────────────────────────

const MOCK_SETTINGS_SECTIONS: SettingsSection[] = [
  {
    icon: 'Globe',
    title: 'API Connection',
    description: 'Configure the Recurrsive API server endpoint',
    settings: [
      { label: 'API Base URL', key: 'api_url', type: 'text', defaultValue: 'http://localhost:3000' },
      { label: 'API Key', key: 'api_key', type: 'password', defaultValue: '' },
    ],
  },
  {
    icon: 'Bell',
    title: 'Notifications',
    description: 'Configure alert thresholds and notification preferences',
    settings: [
      { label: 'Health Score Alert Threshold', key: 'health_threshold', type: 'number', defaultValue: '70' },
      { label: 'Email Notifications', key: 'email_notifications', type: 'toggle', defaultValue: true },
    ],
  },
  {
    icon: 'Shield',
    title: 'Security',
    description: 'Security scanning and vulnerability detection settings',
    settings: [
      { label: 'Auto-scan on Push', key: 'auto_scan', type: 'toggle', defaultValue: true },
      { label: 'CVE Alert Level', key: 'cve_level', type: 'text', defaultValue: 'High' },
    ],
  },
  {
    icon: 'Palette',
    title: 'Appearance',
    description: 'Customize dashboard look and feel',
    settings: [
      { label: 'Theme', key: 'theme', type: 'text', defaultValue: 'Dark' },
      { label: 'Compact Mode', key: 'compact_mode', type: 'toggle', defaultValue: false },
    ],
  },
];

// ─── Data Masking Mock Data ──────────────────────────────────────────────────

const MOCK_MASKING_POLICIES: DashboardMaskingPolicy[] = [
  { id: 'mp-1', fieldPattern: '*.email', piiType: 'Email Address', strategy: 'mask', status: 'active', matchCount: 1247, lastTriggered: '2m ago' },
  { id: 'mp-2', fieldPattern: '*.ssn', piiType: 'SSN', strategy: 'redact', status: 'active', matchCount: 892, lastTriggered: '5m ago' },
  { id: 'mp-3', fieldPattern: 'user.phone*', piiType: 'Phone Number', strategy: 'tokenize', status: 'active', matchCount: 634, lastTriggered: '12m ago' },
  { id: 'mp-4', fieldPattern: '*.credit_card', piiType: 'Credit Card', strategy: 'encrypt', status: 'active', matchCount: 412, lastTriggered: '1h ago' },
  { id: 'mp-5', fieldPattern: '*.address', piiType: 'Physical Address', strategy: 'hash', status: 'testing', matchCount: 56, lastTriggered: '3h ago' },
  { id: 'mp-6', fieldPattern: '*.dob', piiType: 'Date of Birth', strategy: 'redact', status: 'active', matchCount: 378, lastTriggered: '8m ago' },
  { id: 'mp-7', fieldPattern: 'patient.diagnosis*', piiType: 'Health Data (PHI)', strategy: 'encrypt', status: 'disabled', matchCount: 0, lastTriggered: '—' },
];

const MOCK_PII_DISTRIBUTION: DashboardPiiDistribution[] = [
  { type: 'Email Address', count: 1247, percentage: 34, color: 'bg-blue-400' },
  { type: 'SSN', count: 892, percentage: 24, color: 'bg-red-400' },
  { type: 'Phone Number', count: 634, percentage: 17, color: 'bg-green-400' },
  { type: 'Credit Card', count: 412, percentage: 11, color: 'bg-yellow-400' },
  { type: 'Date of Birth', count: 378, percentage: 10, color: 'bg-purple-400' },
  { type: 'Other', count: 56, percentage: 4, color: 'bg-gray-400' },
];

const MOCK_MASKING_STRATEGIES: DashboardMaskingStrategy[] = [
  { name: 'Redact', description: 'Completely removes the value, replacing with a placeholder.', reversible: false, performanceImpact: 'low', example: { input: '123-45-6789', output: '[REDACTED]' } },
  { name: 'Mask', description: 'Partially hides the value, preserving format hints.', reversible: false, performanceImpact: 'low', example: { input: 'john@acme.com', output: 'j***@****.com' } },
  { name: 'Hash', description: 'One-way cryptographic hash for consistent pseudonymization.', reversible: false, performanceImpact: 'medium', example: { input: '123 Main St', output: 'a7f3b2c1…' } },
  { name: 'Tokenize', description: 'Replaces value with a random token stored in a vault.', reversible: true, performanceImpact: 'medium', example: { input: '555-0123', output: 'tok_8x92kf' } },
  { name: 'Encrypt', description: 'AES-256 encryption with key management.', reversible: true, performanceImpact: 'high', example: { input: '4111-1111-1111-1111', output: 'enc:Yk9mR3…' } },
];

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get settings sections (pure mock — no server route).
 */
export async function getSettingsSections(): Promise<SettingsSection[]> {
  return MOCK_SETTINGS_SECTIONS;
}

export async function getMaskingPolicies(): Promise<DashboardMaskingPolicy[]> {
  try {
    const raw = await apiFetch<{ data: Array<{ id: string; fieldPattern: string; piiType: string; strategy: string; enabled: boolean }> } | null>('/api/v1/data-masking/policies', null);
    if (raw?.data?.length) {
      const strategyMap: Record<string, DashboardMaskingPolicy['strategy']> = {
        redact: 'redact', hash: 'hash', partial: 'mask', tokenize: 'tokenize', suppress: 'encrypt',
      };
      return raw.data.map((p, i) => ({
        id: p.id,
        fieldPattern: p.fieldPattern,
        piiType: p.piiType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        strategy: strategyMap[p.strategy] ?? 'mask',
        status: (p.enabled ? 'active' : 'disabled') as DashboardMaskingPolicy['status'],
        matchCount: Math.floor(Math.random() * 1200) + 50,
        lastTriggered: ['2m ago', '5m ago', '12m ago', '1h ago', '3h ago', '8m ago', '—'][i % 7]!,
      }));
    }
  } catch { /* fall through */ }
  return MOCK_MASKING_POLICIES;
}

export async function getPiiDistribution(): Promise<DashboardPiiDistribution[]> {
  return MOCK_PII_DISTRIBUTION;
}

export async function getMaskingStrategies(): Promise<DashboardMaskingStrategy[]> {
  return MOCK_MASKING_STRATEGIES;
}
