'use client';

/**
 * Domain Intelligence Packs page.
 *
 * Browse, install, and manage domain-specific intelligence packs.
 */

import { useState } from 'react';
import { Package, Shield, Heart, DollarSign, Container, Brain } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Analyzer {
  name: string;
  description: string;
  ruleCount: number;
}

interface IntelligencePack {
  id: string;
  name: string;
  domain: string;
  icon: keyof typeof ICON_MAP;
  version: string;
  status: 'installed' | 'available' | 'updating';
  description: string;
  analyzers: Analyzer[];
  frameworks: string[];
  entityTypes: string[];
  totalRules: number;
  lastUpdated: string;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

const ICON_MAP = { Heart, DollarSign, Container, Brain } as const;

// ─── Demo Data ───────────────────────────────────────────────────────────────

const PACKS: IntelligencePack[] = [
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    installed: 'bg-green-500/20 text-green-400 border-green-500/30',
    available: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    updating: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${m[status] ?? ''}`}>{status}</span>;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function IntelligencePacksPage() {
  const [packs, setPacks] = useState(PACKS);
  const [expanded, setExpanded] = useState<string | null>(PACKS[0].id);

  const toggleInstall = (id: string) => {
    setPacks(prev => prev.map(p =>
      p.id === id ? { ...p, status: p.status === 'installed' ? 'available' : 'installed' } : p
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Package className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
          Intelligence Packs
        </h1>
        <p className="text-sm text-text-secondary mt-1">Domain-specific analyzers, rules, and compliance frameworks.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs text-text-tertiary uppercase">Total Packs</p>
          <p className="text-2xl font-bold text-text-primary">{packs.length}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs text-text-tertiary uppercase">Installed</p>
          <p className="text-2xl font-bold text-green-400">{packs.filter(p => p.status === 'installed').length}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs text-text-tertiary uppercase">Total Rules</p>
          <p className="text-2xl font-bold text-text-primary">{packs.reduce((a, p) => a + p.totalRules, 0)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs text-text-tertiary uppercase">Frameworks</p>
          <p className="text-2xl font-bold text-text-primary">{new Set(packs.flatMap(p => p.frameworks)).size}</p>
        </div>
      </div>

      {/* Pack Cards */}
      <div className="space-y-4">
        {packs.map(pack => {
          const Icon = ICON_MAP[pack.icon];
          const isExpanded = expanded === pack.id;
          return (
            <div key={pack.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              {/* Card Header */}
              <div className="flex items-center gap-4 p-5 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : pack.id)}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-base)' }}>
                  <Icon className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-text-primary font-semibold">{pack.name}</h3>
                    <span className="text-xs text-text-tertiary">v{pack.version}</span>
                    <StatusBadge status={pack.status as string} />
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">{pack.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-text-tertiary">{pack.totalRules} rules</span>
                  <button onClick={e => { e.stopPropagation(); toggleInstall(pack.id); }}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: pack.status === 'installed' ? 'var(--color-base)' : 'var(--color-accent)',
                      color: pack.status === 'installed' ? 'var(--color-text-secondary)' : '#fff',
                      border: '1px solid var(--color-border)',
                    }}>
                    {pack.status === 'installed' ? 'Uninstall' : 'Install'}
                  </button>
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-5 pb-5 space-y-4">
                  {/* Frameworks */}
                  <div>
                    <p className="text-xs text-text-tertiary uppercase mb-2">Frameworks</p>
                    <div className="flex flex-wrap gap-2">
                      {pack.frameworks.map(f => (
                        <span key={f} className="px-2 py-0.5 rounded-full text-xs border bg-purple-500/20 text-purple-400 border-purple-500/30">
                          <Shield className="w-3 h-3 inline mr-1" />{f}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Entity Types */}
                  <div>
                    <p className="text-xs text-text-tertiary uppercase mb-2">Entity Types</p>
                    <div className="flex flex-wrap gap-2">
                      {pack.entityTypes.map(e => (
                        <span key={e} className="px-2 py-0.5 rounded-full text-xs border bg-blue-500/20 text-blue-400 border-blue-500/30">{e}</span>
                      ))}
                    </div>
                  </div>

                  {/* Analyzers */}
                  <div>
                    <p className="text-xs text-text-tertiary uppercase mb-2">Analyzers</p>
                    <div className="space-y-2">
                      {pack.analyzers.map(a => (
                        <div key={a.name} className="flex items-center gap-4 p-3 rounded-xl" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-text-primary">{a.name}</p>
                            <p className="text-xs text-text-tertiary">{a.description}</p>
                          </div>
                          <span className="text-sm font-bold text-text-primary">{a.ruleCount} rules</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
