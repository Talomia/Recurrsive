'use client';

/**
 * Data Masking & PII Controls page.
 *
 * Manage masking policies, review PII distribution, and test scan rules.
 */

import { useState } from 'react';
import { Eye, EyeOff, Shield, Lock, Fingerprint, AlertTriangle } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MaskingPolicy {
  id: string;
  fieldPattern: string;
  piiType: string;
  strategy: 'redact' | 'hash' | 'tokenize' | 'mask' | 'encrypt';
  status: 'active' | 'disabled' | 'testing';
  matchCount: number;
  lastTriggered: string;
}

interface PiiDistribution {
  type: string;
  count: number;
  percentage: number;
  color: string;
}

interface Strategy {
  name: string;
  description: string;
  reversible: boolean;
  performanceImpact: 'low' | 'medium' | 'high';
  example: { input: string; output: string };
}

// ─── Demo Data ───────────────────────────────────────────────────────────────

const POLICIES: MaskingPolicy[] = [
  { id: 'mp-1', fieldPattern: '*.email', piiType: 'Email Address', strategy: 'mask', status: 'active', matchCount: 1247, lastTriggered: '2m ago' },
  { id: 'mp-2', fieldPattern: '*.ssn', piiType: 'SSN', strategy: 'redact', status: 'active', matchCount: 892, lastTriggered: '5m ago' },
  { id: 'mp-3', fieldPattern: 'user.phone*', piiType: 'Phone Number', strategy: 'tokenize', status: 'active', matchCount: 634, lastTriggered: '12m ago' },
  { id: 'mp-4', fieldPattern: '*.credit_card', piiType: 'Credit Card', strategy: 'encrypt', status: 'active', matchCount: 412, lastTriggered: '1h ago' },
  { id: 'mp-5', fieldPattern: '*.address', piiType: 'Physical Address', strategy: 'hash', status: 'testing', matchCount: 56, lastTriggered: '3h ago' },
  { id: 'mp-6', fieldPattern: '*.dob', piiType: 'Date of Birth', strategy: 'redact', status: 'active', matchCount: 378, lastTriggered: '8m ago' },
  { id: 'mp-7', fieldPattern: 'patient.diagnosis*', piiType: 'Health Data (PHI)', strategy: 'encrypt', status: 'disabled', matchCount: 0, lastTriggered: '—' },
];

const PII_DISTRIBUTION: PiiDistribution[] = [
  { type: 'Email Address', count: 1247, percentage: 34, color: 'bg-blue-400' },
  { type: 'SSN', count: 892, percentage: 24, color: 'bg-red-400' },
  { type: 'Phone Number', count: 634, percentage: 17, color: 'bg-green-400' },
  { type: 'Credit Card', count: 412, percentage: 11, color: 'bg-yellow-400' },
  { type: 'Date of Birth', count: 378, percentage: 10, color: 'bg-purple-400' },
  { type: 'Other', count: 56, percentage: 4, color: 'bg-gray-400' },
];

const STRATEGIES: Strategy[] = [
  { name: 'Redact', description: 'Completely removes the value, replacing with a placeholder.', reversible: false, performanceImpact: 'low', example: { input: '123-45-6789', output: '[REDACTED]' } },
  { name: 'Mask', description: 'Partially hides the value, preserving format hints.', reversible: false, performanceImpact: 'low', example: { input: 'john@acme.com', output: 'j***@****.com' } },
  { name: 'Hash', description: 'One-way cryptographic hash for consistent pseudonymization.', reversible: false, performanceImpact: 'medium', example: { input: '123 Main St', output: 'a7f3b2c1…' } },
  { name: 'Tokenize', description: 'Replaces value with a random token stored in a vault.', reversible: true, performanceImpact: 'medium', example: { input: '555-0123', output: 'tok_8x92kf' } },
  { name: 'Encrypt', description: 'AES-256 encryption with key management.', reversible: true, performanceImpact: 'high', example: { input: '4111-1111-1111-1111', output: 'enc:Yk9mR3…' } },
];

const DEMO_INPUT = `{
  "user": {
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "ssn": "123-45-6789",
    "phone": "555-867-5309"
  }
}`;

const DEMO_OUTPUT = `{
  "user": {
    "name": "Jane Doe",
    "email": "j***@*******.com",
    "ssn": "[REDACTED]",
    "phone": "tok_q8m2x1"
  }
}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    disabled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    testing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${m[status] ?? ''}`}>{status}</span>;
}

function StrategyBadge({ strategy }: { strategy: string }) {
  const m: Record<string, string> = {
    redact: 'bg-red-500/20 text-red-400 border-red-500/30',
    mask: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    hash: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    tokenize: 'bg-green-500/20 text-green-400 border-green-500/30',
    encrypt: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${m[strategy] ?? ''}`}>{strategy}</span>;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DataMaskingPage() {
  const [showDemo, setShowDemo] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <EyeOff className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
          Data Masking & PII Controls
        </h1>
        <p className="text-sm text-text-secondary mt-1">Configure masking policies, audit PII exposure, and test data protection rules.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Policies', value: POLICIES.filter(p => p.status === 'active').length, icon: Shield },
          { label: 'PII Fields Detected', value: PII_DISTRIBUTION.reduce((a, d) => a + d.count, 0).toLocaleString(), icon: Fingerprint },
          { label: 'Strategies', value: STRATEGIES.length, icon: Lock },
          { label: 'Alerts', value: POLICIES.filter(p => p.status === 'disabled').length, icon: AlertTriangle },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-xs text-text-tertiary uppercase">{k.label}</p>
            <p className="text-2xl font-bold text-text-primary">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Masking Policy Table */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
          <h3 className="text-lg font-semibold text-text-primary">Masking Policies</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-text-tertiary text-xs uppercase">
              <th className="pb-3">Field Pattern</th><th className="pb-3">PII Type</th><th className="pb-3">Strategy</th><th className="pb-3">Status</th><th className="pb-3">Matches</th><th className="pb-3">Last Triggered</th>
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {POLICIES.map(p => (
                <tr key={p.id} className="hover:bg-white/5">
                  <td className="py-3 font-mono text-sm text-text-primary">{p.fieldPattern}</td>
                  <td className="py-3 text-text-secondary">{p.piiType}</td>
                  <td className="py-3"><StrategyBadge strategy={p.strategy} /></td>
                  <td className="py-3"><StatusBadge status={p.status} /></td>
                  <td className="py-3 text-text-primary font-semibold">{p.matchCount.toLocaleString()}</td>
                  <td className="py-3 text-text-secondary">{p.lastTriggered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PII Distribution */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Fingerprint className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
          <h3 className="text-lg font-semibold text-text-primary">PII Type Distribution</h3>
        </div>
        {/* Bar */}
        <div className="flex h-4 rounded-full overflow-hidden mb-4">
          {PII_DISTRIBUTION.map(d => (
            <div key={d.type} className={`${d.color}`} style={{ width: `${d.percentage}%` }} title={`${d.type}: ${d.percentage}%`} />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PII_DISTRIBUTION.map(d => (
            <div key={d.type} className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${d.color}`} />
              <span className="text-xs text-text-secondary">{d.type}</span>
              <span className="text-xs text-text-tertiary ml-auto">{d.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Strategy Cards */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
          <h3 className="text-lg font-semibold text-text-primary">Masking Strategies</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STRATEGIES.map(s => (
            <div key={s.name} className="p-4 rounded-xl" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
              <h4 className="text-sm font-semibold text-text-primary mb-1">{s.name}</h4>
              <p className="text-xs text-text-secondary mb-3">{s.description}</p>
              <div className="flex items-center gap-3 text-xs mb-2">
                <span className={s.reversible ? 'text-green-400' : 'text-red-400'}>{s.reversible ? 'Reversible' : 'Irreversible'}</span>
                <span className="text-text-tertiary">Perf: {s.performanceImpact}</span>
              </div>
              <div className="p-2 rounded-lg font-mono text-xs" style={{ background: 'var(--color-surface)' }}>
                <span className="text-text-tertiary">{s.example.input}</span>
                <span className="text-text-tertiary mx-2">→</span>
                <span className="text-text-primary">{s.example.output}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PII Scan Demo */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
            <h3 className="text-lg font-semibold text-text-primary">PII Scan Demo</h3>
          </div>
          <button onClick={() => setShowDemo(!showDemo)}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ background: 'var(--color-accent)' }}>
            {showDemo ? 'Hide' : 'Run Scan'}
          </button>
        </div>
        {showDemo && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-text-tertiary uppercase mb-2">Input</p>
              <pre className="p-3 rounded-lg text-xs font-mono text-text-secondary overflow-auto" style={{ background: 'var(--color-base)' }}>{DEMO_INPUT}</pre>
            </div>
            <div>
              <p className="text-xs text-text-tertiary uppercase mb-2">Masked Output</p>
              <pre className="p-3 rounded-lg text-xs font-mono text-green-400 overflow-auto" style={{ background: 'var(--color-base)' }}>{DEMO_OUTPUT}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
