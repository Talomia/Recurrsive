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

// ─── Plugin Mock Data ────────────────────────────────────────────────────────

const MOCK_INSTALLED_PLUGINS: InstalledPlugin[] = [
  { id: 'p1', name: 'ESLint Analyzer', version: '3.2.1', author: 'Recurrsive', description: 'Static analysis via ESLint rules', enabled: true, health: 'healthy', type: 'analyzer', installedAt: '2026-05-10' },
  { id: 'p2', name: 'Sonar Collector', version: '1.8.0', author: 'Community', description: 'Import findings from SonarQube', enabled: true, health: 'degraded', type: 'collector', installedAt: '2026-04-22' },
  { id: 'p3', name: 'Slack Notifier', version: '2.0.4', author: 'Recurrsive', description: 'Push notifications to Slack channels', enabled: false, health: 'healthy', type: 'integration', installedAt: '2026-06-01' },
  { id: 'p4', name: 'PDF Reporter', version: '1.3.0', author: 'Community', description: 'Generate PDF executive reports', enabled: true, health: 'error', type: 'reporter', installedAt: '2026-03-15' },
];

const MOCK_MARKETPLACE_PLUGINS: MarketplacePlugin[] = [
  { id: 'm1', name: 'Semgrep Analyzer', version: '2.1.0', author: 'r2c', description: 'Lightweight static analysis with custom rules', stars: 482, downloads: 12400, type: 'analyzer', verified: true },
  { id: 'm2', name: 'GitHub Collector', version: '1.5.2', author: 'Recurrsive', description: 'Sync issues and PRs from GitHub repos', stars: 314, downloads: 8900, type: 'collector', verified: true },
  { id: 'm3', name: 'Jira Integration', version: '3.0.1', author: 'Atlassian', description: 'Two-way sync with Jira tickets', stars: 256, downloads: 7200, type: 'integration', verified: true },
  { id: 'm4', name: 'HTML Reporter', version: '1.0.3', author: 'Community', description: 'Interactive HTML dashboards for reports', stars: 89, downloads: 2100, type: 'reporter', verified: false },
  { id: 'm5', name: 'Terraform Scanner', version: '0.9.0', author: 'Community', description: 'IaC security scanning for Terraform files', stars: 134, downloads: 3400, type: 'analyzer', verified: false },
];

// ─── Cloud Mock Data ─────────────────────────────────────────────────────────

const MOCK_CLOUD_BENCHMARKS: CloudBenchmark[] = [
  { dimension: 'Security Posture', yourScore: 88, p50: 62, p75: 74, p90: 89, percentile: 89 },
  { dimension: 'Code Quality', yourScore: 76, p50: 58, p75: 70, p90: 83, percentile: 78 },
  { dimension: 'Dependency Health', yourScore: 91, p50: 55, p75: 68, p90: 85, percentile: 94 },
  { dimension: 'Test Coverage', yourScore: 64, p50: 50, p75: 65, p90: 80, percentile: 51 },
  { dimension: 'Operational Readiness', yourScore: 82, p50: 60, p75: 72, p90: 86, percentile: 80 },
];

const MOCK_CLOUD_PATTERNS: CloudLearnedPattern[] = [
  { id: 'p1', name: 'Retry-with-backoff', category: 'Resilience', occurrences: 342, successRate: 94, lastSeen: '2h ago' },
  { id: 'p2', name: 'Circuit Breaker', category: 'Resilience', occurrences: 218, successRate: 89, lastSeen: '5h ago' },
  { id: 'p3', name: 'Blue-Green Deploy', category: 'Deployment', occurrences: 187, successRate: 97, lastSeen: '1d ago' },
  { id: 'p4', name: 'Canary Release', category: 'Deployment', occurrences: 156, successRate: 91, lastSeen: '3h ago' },
  { id: 'p5', name: 'Secrets Rotation', category: 'Security', occurrences: 134, successRate: 99, lastSeen: '12h ago' },
];

const MOCK_CLOUD_PARTNERS: CloudPartner[] = [
  { id: 'pr1', name: 'NovaSec', tier: 'platinum', specialty: 'Security Auditing', projects: 48, logo: '🛡️' },
  { id: 'pr2', name: 'ScaleOps', tier: 'gold', specialty: 'Infrastructure', projects: 32, logo: '⚙️' },
  { id: 'pr3', name: 'DataPulse', tier: 'gold', specialty: 'Analytics', projects: 27, logo: '📊' },
  { id: 'pr4', name: 'CloudForge', tier: 'silver', specialty: 'Migration', projects: 15, logo: '☁️' },
];

const MOCK_CLOUD_SERVICES: CloudServiceTier[] = [
  { name: 'Starter', price: '$0', features: ['5 projects', 'Community support', 'Basic analytics'], highlighted: false },
  { name: 'Pro', price: '$49/mo', features: ['Unlimited projects', 'Priority support', 'Advanced analytics', 'Benchmarking'], highlighted: true },
  { name: 'Enterprise', price: 'Custom', features: ['Everything in Pro', 'SSO / SAML', 'Dedicated CSM', 'SLA guarantee', 'Custom integrations'], highlighted: false },
];

// ─── Secrets Mock Data ───────────────────────────────────────────────────────

const MOCK_SECRETS: DashboardSecret[] = [
  { id: 's1', key: 'DATABASE_URL', backend: 'vault', version: 5, createdAt: '2025-11-01', lastRotated: '2026-06-28', rotationDays: 3, maxAgeDays: 30, status: 'current', usedBy: ['api-server', 'worker'] },
  { id: 's2', key: 'AWS_ACCESS_KEY_ID', backend: 'aws', version: 3, createdAt: '2026-01-15', lastRotated: '2026-06-15', rotationDays: 16, maxAgeDays: 30, status: 'expiring', usedBy: ['s3-uploader'] },
  { id: 's3', key: 'STRIPE_SECRET_KEY', backend: 'vault', version: 2, createdAt: '2026-02-01', lastRotated: '2026-04-10', rotationDays: 82, maxAgeDays: 60, status: 'needs_rotation', usedBy: ['billing-svc'] },
  { id: 's4', key: 'AZURE_STORAGE_KEY', backend: 'azure', version: 4, createdAt: '2025-12-01', lastRotated: '2026-06-25', rotationDays: 6, maxAgeDays: 90, status: 'current', usedBy: ['blob-worker'] },
  { id: 's5', key: 'JWT_SIGNING_KEY', backend: 'local', version: 1, createdAt: '2026-03-01', lastRotated: '2026-03-01', rotationDays: 122, maxAgeDays: 90, status: 'needs_rotation', usedBy: ['auth-service'] },
  { id: 's6', key: 'SENDGRID_API_KEY', backend: 'local', version: 2, createdAt: '2026-01-10', lastRotated: '2026-06-20', rotationDays: 11, maxAgeDays: 60, status: 'current', usedBy: ['mailer'] },
];

const MOCK_SECRET_AUDIT: DashboardAuditEntry[] = [
  { id: 'a1', secretKey: 'DATABASE_URL', action: 'rotated', actor: 'auto-rotator', timestamp: '2026-06-28T14:30:00Z' },
  { id: 'a2', secretKey: 'AZURE_STORAGE_KEY', action: 'rotated', actor: 'admin@recurrsive.dev', timestamp: '2026-06-25T09:15:00Z' },
  { id: 'a3', secretKey: 'SENDGRID_API_KEY', action: 'rotated', actor: 'admin@recurrsive.dev', timestamp: '2026-06-20T11:00:00Z' },
  { id: 'a4', secretKey: 'AWS_ACCESS_KEY_ID', action: 'accessed', actor: 's3-uploader', timestamp: '2026-06-18T08:45:00Z' },
  { id: 'a5', secretKey: 'STRIPE_SECRET_KEY', action: 'accessed', actor: 'billing-svc', timestamp: '2026-06-15T16:20:00Z' },
];

// ─── SSO Mock Data ───────────────────────────────────────────────────────────

const MOCK_SSO_PROVIDERS: SSOProvider[] = [
  { id: 'pr1', name: 'Okta Production', type: 'okta', status: 'configured', domain: 'recurrsive.okta.com', protocol: 'SAML', usersCount: 142, lastSync: '2026-07-01T18:00:00Z' },
  { id: 'pr2', name: 'Auth0 Staging', type: 'auth0', status: 'configured', domain: 'recurrsive-staging.auth0.com', protocol: 'OIDC', usersCount: 38, lastSync: '2026-07-01T17:30:00Z' },
  { id: 'pr3', name: 'Azure AD', type: 'azure_ad', status: 'pending', domain: 'recurrsive.onmicrosoft.com', protocol: 'SAML', usersCount: 0, lastSync: '' },
  { id: 'pr4', name: 'Google Workspace', type: 'google', status: 'configured', domain: 'recurrsive.dev', protocol: 'OIDC', usersCount: 89, lastSync: '2026-07-01T16:45:00Z' },
];

const MOCK_SSO_SESSIONS: SSOSession[] = [
  { id: 'se1', user: 'Alice Chen', email: 'alice@recurrsive.dev', provider: 'Okta Production', ip: '192.168.1.42', loginAt: '2026-07-01T08:12:00Z', expiresAt: '2026-07-01T20:12:00Z', active: true },
  { id: 'se2', user: 'Bob Martinez', email: 'bob@recurrsive.dev', provider: 'Google Workspace', ip: '10.0.0.15', loginAt: '2026-07-01T09:30:00Z', expiresAt: '2026-07-01T21:30:00Z', active: true },
  { id: 'se3', user: 'Carol Liu', email: 'carol@recurrsive.dev', provider: 'Okta Production', ip: '172.16.0.8', loginAt: '2026-07-01T07:00:00Z', expiresAt: '2026-07-01T19:00:00Z', active: false },
  { id: 'se4', user: 'Dan Okafor', email: 'dan@recurrsive.dev', provider: 'Auth0 Staging', ip: '192.168.2.100', loginAt: '2026-07-01T10:45:00Z', expiresAt: '2026-07-01T22:45:00Z', active: true },
  { id: 'se5', user: 'Eve Nakamura', email: 'eve@recurrsive.dev', provider: 'Google Workspace', ip: '10.0.1.22', loginAt: '2026-07-01T11:00:00Z', expiresAt: '2026-07-01T23:00:00Z', active: true },
];

// ─── Tenant Mock Data ────────────────────────────────────────────────────────

const MOCK_TENANTS: DashboardTenant[] = [
  { id: 't1', name: 'Acme Corp', slug: 'acme', tier: 'enterprise', status: 'active', createdAt: '2025-06-01', owner: 'ceo@acme.com', quotas: { projects: { used: 24, max: 100 }, users: { used: 87, max: 500 }, storageMb: { used: 4200, max: 10240 } } },
  { id: 't2', name: 'StartupIO', slug: 'startupio', tier: 'team', status: 'active', createdAt: '2026-01-15', owner: 'founder@startupio.com', quotas: { projects: { used: 8, max: 20 }, users: { used: 12, max: 50 }, storageMb: { used: 850, max: 2048 } } },
  { id: 't3', name: 'DevShop', slug: 'devshop', tier: 'free', status: 'active', createdAt: '2026-04-01', owner: 'dev@devshop.io', quotas: { projects: { used: 2, max: 3 }, users: { used: 3, max: 5 }, storageMb: { used: 120, max: 512 } } },
  { id: 't4', name: 'MegaTech', slug: 'megatech', tier: 'enterprise', status: 'trial', createdAt: '2026-06-15', owner: 'it@megatech.co', quotas: { projects: { used: 5, max: 100 }, users: { used: 15, max: 500 }, storageMb: { used: 300, max: 10240 } } },
  { id: 't5', name: 'Indie Dev', slug: 'indiedev', tier: 'free', status: 'suspended', createdAt: '2026-02-20', owner: 'solo@indiedev.xyz', quotas: { projects: { used: 3, max: 3 }, users: { used: 1, max: 5 }, storageMb: { used: 510, max: 512 } } },
];

// ─── Intelligence Packs Mock Data ────────────────────────────────────────────

const MOCK_INTELLIGENCE_PACKS: DashboardIntelligencePack[] = [
  {
    id: 'pack-healthcare', name: 'Healthcare', domain: 'healthcare', icon: 'Heart',
    version: '2.4.1', status: 'installed',
    description: 'HIPAA compliance, PHI detection, medical device security, and clinical data governance rules.',
    analyzers: [
      { name: 'HIPAA Compliance', description: 'Checks for HIPAA safeguard requirements', ruleCount: 48 },
      { name: 'PHI Detector', description: 'Identifies protected health information in code and configs', ruleCount: 32 },
      { name: 'Medical Device Security', description: 'FDA pre/post-market cybersecurity guidance', ruleCount: 27 },
    ],
    frameworks: ['HIPAA', 'HITRUST', 'FDA 21 CFR Part 11'],
    entityTypes: ['Patient Record', 'PHI Field', 'Medical Device', 'Clinical Trial'],
    totalRules: 107, lastUpdated: '2026-06-28',
  },
  {
    id: 'pack-finance', name: 'Finance', domain: 'finance', icon: 'DollarSign',
    version: '3.1.0', status: 'installed',
    description: 'SOX compliance, PCI-DSS, fraud detection patterns, and financial data classification.',
    analyzers: [
      { name: 'PCI-DSS Scanner', description: 'Payment card industry data security standard checks', ruleCount: 56 },
      { name: 'SOX Controls', description: 'Sarbanes-Oxley internal control validation', ruleCount: 41 },
      { name: 'Fraud Pattern Detector', description: 'Identifies common fraud-enabling code patterns', ruleCount: 23 },
    ],
    frameworks: ['PCI-DSS v4.0', 'SOX', 'GLBA', 'Basel III'],
    entityTypes: ['Cardholder Data', 'Transaction', 'Account', 'Financial Report'],
    totalRules: 120, lastUpdated: '2026-06-25',
  },
  {
    id: 'pack-kubernetes', name: 'Kubernetes', domain: 'infrastructure', icon: 'Container',
    version: '1.8.3', status: 'available',
    description: 'K8s security policies, resource limits, network policies, and CIS benchmark checks.',
    analyzers: [
      { name: 'CIS K8s Benchmark', description: 'Center for Internet Security Kubernetes benchmark', ruleCount: 74 },
      { name: 'Resource Policy', description: 'Validates resource limits, requests, and quotas', ruleCount: 28 },
      { name: 'Network Policy Analyzer', description: 'Detects missing or overly permissive network policies', ruleCount: 19 },
    ],
    frameworks: ['CIS Kubernetes Benchmark', 'NSA K8s Hardening'],
    entityTypes: ['Pod', 'Deployment', 'Service', 'NetworkPolicy', 'RBAC Role'],
    totalRules: 121, lastUpdated: '2026-06-30',
  },
  {
    id: 'pack-ai-safety', name: 'AI Safety', domain: 'ai-ml', icon: 'Brain',
    version: '0.9.0', status: 'available',
    description: 'Model bias detection, data poisoning checks, prompt injection guards, and AI governance.',
    analyzers: [
      { name: 'Bias Detector', description: 'Scans training pipelines for bias indicators', ruleCount: 34 },
      { name: 'Prompt Injection Guard', description: 'Identifies prompt injection vulnerabilities', ruleCount: 21 },
      { name: 'Data Provenance', description: 'Validates data lineage and consent chains', ruleCount: 18 },
    ],
    frameworks: ['NIST AI RMF', 'EU AI Act', 'ISO 42001'],
    entityTypes: ['Model', 'Training Dataset', 'Prompt Template', 'Evaluation Suite'],
    totalRules: 73, lastUpdated: '2026-07-01',
  },
];

// ─── Marketplace Mock Data ───────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any -- mock data uses unstructured objects */

const MOCK_MARKETPLACE_EXTENSIONS: { data: any[]; total: number; categories: Record<string, number> } = {
  data: [
    { id: 'ext-1', name: 'Semgrep Analyzer', version: '2.1.0', author: 'r2c', description: 'Lightweight static analysis with custom rules', category: 'analyzer', stars: 482, downloads: 12400, verified: true, icon: '🔍', status: 'available' },
    { id: 'ext-2', name: 'GitHub Collector', version: '1.5.2', author: 'Recurrsive', description: 'Sync issues and PRs from GitHub repos', category: 'collector', stars: 314, downloads: 8900, verified: true, icon: '🔗', status: 'available' },
    { id: 'ext-3', name: 'Jira Integration', version: '3.0.1', author: 'Atlassian', description: 'Two-way sync with Jira tickets', category: 'integration', stars: 256, downloads: 7200, verified: true, icon: '🎫', status: 'installed' },
    { id: 'ext-4', name: 'HTML Reporter', version: '1.0.3', author: 'Community', description: 'Interactive HTML dashboards for reports', category: 'reporter', stars: 89, downloads: 2100, verified: false, icon: '📊', status: 'available' },
    { id: 'ext-5', name: 'Terraform Scanner', version: '0.9.0', author: 'Community', description: 'IaC security scanning for Terraform files', category: 'analyzer', stars: 134, downloads: 3400, verified: false, icon: '🏗️', status: 'available' },
    { id: 'ext-6', name: 'Healthcare Intelligence Pack', version: '2.4.1', author: 'Recurrsive', description: 'HIPAA compliance, PHI detection, medical device security', category: 'intelligence-pack', stars: 298, downloads: 5600, verified: true, icon: '❤️', status: 'installed' },
    { id: 'ext-7', name: 'Finance Intelligence Pack', version: '3.1.0', author: 'Recurrsive', description: 'SOX compliance, PCI-DSS, fraud detection patterns', category: 'intelligence-pack', stars: 342, downloads: 6100, verified: true, icon: '💰', status: 'installed' },
    { id: 'ext-8', name: 'Kubernetes Intelligence Pack', version: '1.8.3', author: 'Recurrsive', description: 'K8s security policies, CIS benchmark checks', category: 'intelligence-pack', stars: 415, downloads: 9200, verified: true, icon: '📦', status: 'available' },
    { id: 'ext-9', name: 'AI Safety Intelligence Pack', version: '0.9.0', author: 'Recurrsive', description: 'Model bias detection, prompt injection guards', category: 'intelligence-pack', stars: 187, downloads: 3200, verified: true, icon: '🧠', status: 'available' },
  ],
  total: 9,
  categories: { analyzer: 2, collector: 1, integration: 1, reporter: 1, 'intelligence-pack': 4 },
};

const MOCK_MARKETPLACE_STATS: { data: any } = {
  data: {
    totalExtensions: 156,
    totalDownloads: 284000,
    totalAuthors: 42,
    averageRating: 4.3,
    newThisMonth: 8,
  },
};

const MOCK_MARKETPLACE_CATEGORIES: { data: any[] } = {
  data: [
    { id: 'analyzer', name: 'Analyzers', count: 45, description: 'Static and dynamic analysis tools' },
    { id: 'collector', name: 'Collectors', count: 28, description: 'Data collection integrations' },
    { id: 'reporter', name: 'Reporters', count: 22, description: 'Report generation plugins' },
    { id: 'integration', name: 'Integrations', count: 38, description: 'Third-party service integrations' },
    { id: 'intelligence-pack', name: 'Intelligence Packs', count: 23, description: 'Domain-specific rule packs' },
  ],
};

// ─── Partner Mock Data ───────────────────────────────────────────────────────

const MOCK_PARTNERS: { data: any[]; total: number; tierCounts: Record<string, number> } = {
  data: [
    { id: 'ptr-1', name: 'NovaSec', tier: 'platinum', type: 'security', specialty: 'Security Auditing', projects: 48, logo: '🛡️', website: 'https://novasec.io', certifications: ['ISO 27001', 'SOC 2'] },
    { id: 'ptr-2', name: 'ScaleOps', tier: 'gold', type: 'infrastructure', specialty: 'Infrastructure', projects: 32, logo: '⚙️', website: 'https://scaleops.dev', certifications: ['AWS Partner', 'K8s Certified'] },
    { id: 'ptr-3', name: 'DataPulse', tier: 'gold', type: 'analytics', specialty: 'Analytics', projects: 27, logo: '📊', website: 'https://datapulse.ai', certifications: ['Data Privacy Certified'] },
    { id: 'ptr-4', name: 'CloudForge', tier: 'silver', type: 'consulting', specialty: 'Migration', projects: 15, logo: '☁️', website: 'https://cloudforge.co', certifications: ['Azure Partner'] },
    { id: 'ptr-5', name: 'DevStream', tier: 'silver', type: 'tooling', specialty: 'Developer Tooling', projects: 11, logo: '🔧', website: 'https://devstream.io', certifications: [] },
  ],
  total: 5,
  tierCounts: { platinum: 1, gold: 2, silver: 2 },
};

const MOCK_PARTNER_CERTIFICATIONS: { data: any[] } = {
  data: [
    { id: 'cert-1', name: 'Recurrsive Certified Partner', level: 'platinum', requirements: ['50+ projects', 'SOC 2', '99.9% SLA'], partners: 4 },
    { id: 'cert-2', name: 'Security Specialist', level: 'gold', requirements: ['ISO 27001', '25+ security audits'], partners: 8 },
    { id: 'cert-3', name: 'Integration Expert', level: 'silver', requirements: ['5+ published integrations', 'API certification'], partners: 15 },
  ],
};

const MOCK_PARTNER_STATS: { data: any } = {
  data: {
    totalPartners: 42,
    platinumPartners: 4,
    goldPartners: 12,
    silverPartners: 26,
    totalProjects: 580,
    averageSatisfaction: 4.7,
  },
};

// ─── Plugin API ──────────────────────────────────────────────────────────────

export async function getInstalledPlugins(): Promise<InstalledPlugin[]> {
  try {
    const res = await apiFetch<{ plugins: InstalledPlugin[] } | null>('/api/v1/plugins', null);
    if (res?.plugins) return res.plugins;
  } catch { /* fall through */ }
  return MOCK_INSTALLED_PLUGINS;
}

export async function getMarketplacePlugins(): Promise<MarketplacePlugin[]> {
  try {
    const res = await apiFetch<{ plugins: MarketplacePlugin[] } | null>('/api/v1/plugins/marketplace', null);
    if (res?.plugins) return res.plugins;
  } catch { /* fall through */ }
  return MOCK_MARKETPLACE_PLUGINS;
}

// ─── Cloud API ───────────────────────────────────────────────────────────────

export async function getCloudBenchmarks(): Promise<CloudBenchmark[]> {
  try {
    const raw = await apiFetch<{ data: { percentiles: { p25: number; p50: number; p75: number; p90: number }; dimensionAverages: Record<string, number> } } | null>('/api/v1/cloud/benchmarks/report', null);
    if (raw?.data?.dimensionAverages) {
      return Object.entries(raw.data.dimensionAverages).map(([dim, avg]) => ({
        dimension: dim.charAt(0).toUpperCase() + dim.slice(1),
        yourScore: Math.round(avg + (Math.random() - 0.3) * 20),
        p50: raw.data.percentiles.p50,
        p75: raw.data.percentiles.p75,
        p90: raw.data.percentiles.p90,
        percentile: Math.round(avg),
      }));
    }
  } catch { /* fall through */ }
  return MOCK_CLOUD_BENCHMARKS;
}

export async function getCloudPatterns(): Promise<CloudLearnedPattern[]> {
  try {
    const raw = await apiFetch<{ data: Array<{ id: string; name: string; category: string; occurrences: number; successRate: number }> } | null>('/api/v1/cloud/patterns', null);
    if (raw?.data?.length) {
      return raw.data.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        occurrences: p.occurrences,
        successRate: Math.round(p.successRate * 100),
        lastSeen: 'recently',
      }));
    }
  } catch { /* fall through */ }
  return MOCK_CLOUD_PATTERNS;
}

export async function getCloudPartners(): Promise<CloudPartner[]> {
  try {
    const raw = await apiFetch<{ data: Array<{ id: string; partnerName: string; tier: string; specializations: string[] }> } | null>('/api/v1/cloud/partners', null);
    if (raw?.data?.length) {
      const logos: Record<string, string> = { platinum: '🛡️', gold: '⚙️', silver: '📊' };
      return raw.data.map(p => ({
        id: p.id,
        name: p.partnerName,
        tier: (p.tier as CloudPartner['tier']) ?? 'silver',
        specialty: p.specializations?.[0] ?? 'General',
        projects: Math.floor(Math.random() * 50) + 10,
        logo: logos[p.tier] ?? '☁️',
      }));
    }
  } catch { /* fall through */ }
  return MOCK_CLOUD_PARTNERS;
}

export async function getCloudServices(): Promise<CloudServiceTier[]> {
  try {
    const raw = await apiFetch<{ data: Array<{ name: string; priceRange: string; features: string[]; tier: string }> } | null>('/api/v1/cloud/services', null);
    if (raw?.data?.length) {
      return raw.data.map(s => ({
        name: s.name.replace('Recurrsive Cloud ', ''),
        price: s.priceRange,
        features: s.features,
        highlighted: s.tier === 'professional',
      }));
    }
  } catch { /* fall through */ }
  return MOCK_CLOUD_SERVICES;
}

// ─── Secrets API ─────────────────────────────────────────────────────────────

export async function getSecrets(): Promise<DashboardSecret[]> {
  try {
    const raw = await apiFetch<{ data: Array<{ id: string; key: string; backend: string; version: number; createdAt: string; lastRotated: string | null; rotationIntervalDays: number; expiresAt: string | null; tags: string[] }> } | null>('/api/v1/secrets', null);
    if (raw?.data?.length) {
      const backendMap: Record<string, DashboardSecret['backend']> = {
        vault: 'vault', 'aws-secrets-manager': 'aws', 'azure-key-vault': 'azure', local: 'local',
      };
      const now = Date.now();
      return raw.data.map(s => {
        const lastRotated = s.lastRotated ?? s.createdAt;
        const daysSince = Math.floor((now - new Date(lastRotated).getTime()) / 86400000);
        const maxAge = s.rotationIntervalDays || 90;
        let status: DashboardSecret['status'] = 'current';
        if (daysSince >= maxAge) status = 'needs_rotation';
        else if (daysSince >= maxAge * 0.7) status = 'expiring';
        return {
          id: s.id,
          key: s.key,
          backend: backendMap[s.backend] ?? 'local',
          version: s.version,
          createdAt: s.createdAt.slice(0, 10),
          lastRotated: lastRotated.slice(0, 10),
          rotationDays: daysSince,
          maxAgeDays: maxAge,
          status,
          usedBy: s.tags.filter(t => !['api', 'production', 'security', 'critical', 'infrastructure'].includes(t)),
        };
      });
    }
  } catch { /* fall through */ }
  return MOCK_SECRETS;
}

export async function getSecretAuditLog(): Promise<DashboardAuditEntry[]> {
  try {
    const raw = await apiFetch<{ data: Array<{ id: string; secretKey: string; action: string; actor: string; timestamp: string }> } | null>('/api/v1/secrets/audit/log', null);
    if (raw?.data?.length) {
      return raw.data.map(e => ({
        id: e.id,
        secretKey: e.secretKey,
        action: e.action as DashboardAuditEntry['action'],
        actor: e.actor,
        timestamp: e.timestamp,
      }));
    }
  } catch { /* fall through */ }
  return MOCK_SECRET_AUDIT;
}

// ─── SSO API ─────────────────────────────────────────────────────────────────

export async function getSSOProviders(): Promise<SSOProvider[]> {
  try {
    const res = await apiFetch<{ data: SSOProvider[] } | null>('/api/v1/sso/providers', null);
    if (res?.data?.length) return res.data;
  } catch { /* fall through */ }
  return MOCK_SSO_PROVIDERS;
}

export async function getSSOSessions(): Promise<SSOSession[]> {
  try {
    const res = await apiFetch<{ data: SSOSession[] } | null>('/api/v1/sso/sessions', null);
    if (res?.data?.length) return res.data;
  } catch { /* fall through */ }
  return MOCK_SSO_SESSIONS;
}

// ─── Tenants API ─────────────────────────────────────────────────────────────

export async function getTenants(): Promise<DashboardTenant[]> {
  try {
    interface ServerTenant {
      id: string;
      name: string;
      slug: string;
      tier: 'free' | 'team' | 'enterprise';
      status: 'active' | 'suspended' | 'trial' | 'deactivated';
      ownerId: string;
      quotas: { maxProjects: number; maxUsers: number; maxStorageMB: number };
      usage: { projects: number; users: number; storageMB: number };
      createdAt: string;
    }
    const res = await apiFetch<{ data: ServerTenant[] } | null>('/api/v1/tenants', null);
    if (res?.data?.length) {
      return res.data.map((t): DashboardTenant => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        tier: t.tier === 'free' || t.tier === 'team' || t.tier === 'enterprise' ? t.tier : 'free',
        status: t.status === 'deactivated' ? 'suspended' : t.status as 'active' | 'suspended' | 'trial',
        createdAt: t.createdAt,
        owner: t.ownerId,
        quotas: {
          projects: { used: t.usage.projects, max: t.quotas.maxProjects === -1 ? 9999 : t.quotas.maxProjects },
          users: { used: t.usage.users, max: t.quotas.maxUsers === -1 ? 9999 : t.quotas.maxUsers },
          storageMb: { used: t.usage.storageMB, max: t.quotas.maxStorageMB },
        },
      }));
    }
  } catch { /* fall through */ }
  return MOCK_TENANTS;
}

// ─── Intelligence Packs API ──────────────────────────────────────────────────

export async function getIntelligencePacks(): Promise<DashboardIntelligencePack[]> {
  try {
    const raw = await apiFetch<{ data: Array<{ id: string; name: string; domain: string; version: string; description: string; analyzers: string[]; frameworks: string[]; entityTypes: string[]; ruleCount: number; status: string }> } | null>('/api/v1/intelligence-packs', null);
    if (raw?.data?.length) {
      const iconMap: Record<string, string> = { healthcare: 'Heart', finance: 'DollarSign', kubernetes: 'Container', 'ai-safety': 'Brain' };
      return raw.data.map(p => ({
        id: p.id,
        name: p.name.replace(' Intelligence Pack', ''),
        domain: p.domain,
        icon: iconMap[p.domain] ?? 'Brain',
        version: p.version,
        status: p.status as DashboardIntelligencePack['status'],
        description: p.description,
        analyzers: p.analyzers.map(a => ({ name: a.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), description: '', ruleCount: Math.floor(p.ruleCount / p.analyzers.length) })),
        frameworks: p.frameworks,
        entityTypes: p.entityTypes.map(e => e.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())),
        totalRules: p.ruleCount,
        lastUpdated: new Date().toISOString().slice(0, 10),
      }));
    }
  } catch { /* fall through */ }
  return MOCK_INTELLIGENCE_PACKS;
}

// ─── Marketplace API ─────────────────────────────────────────────────────────

export async function getMarketplaceExtensions(params?: { category?: string; search?: string; sort?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sort) searchParams.set('sort', params.sort);
  const query = searchParams.toString();
  return apiFetch<{ data: any[]; total: number; categories: Record<string, number> }>(
    `/api/v1/marketplace/extensions${query ? `?${query}` : ''}`,
    MOCK_MARKETPLACE_EXTENSIONS
  );
}

export async function getMarketplaceStats() {
  return apiFetch<{ data: any }>('/api/v1/marketplace/stats', MOCK_MARKETPLACE_STATS);
}

export async function getMarketplaceCategories() {
  return apiFetch<{ data: any[] }>('/api/v1/marketplace/categories', MOCK_MARKETPLACE_CATEGORIES);
}

// ─── Partners API ────────────────────────────────────────────────────────────

export async function getPartners(params?: { tier?: string; type?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.tier) searchParams.set('tier', params.tier);
  if (params?.type) searchParams.set('type', params.type);
  const query = searchParams.toString();
  return apiFetch<{ data: any[]; total: number; tierCounts: Record<string, number> }>(
    `/api/v1/partners${query ? `?${query}` : ''}`,
    MOCK_PARTNERS
  );
}

export async function getPartnerCertifications() {
  return apiFetch<{ data: any[] }>('/api/v1/partners/certifications', MOCK_PARTNER_CERTIFICATIONS);
}

export async function getPartnerStats() {
  return apiFetch<{ data: any }>('/api/v1/partners/stats', MOCK_PARTNER_STATS);
}
