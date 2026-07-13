'use client';
/**
 * Data Masking & PII Controls page.
 *
 * Manage masking policies, review PII distribution, and test scan rules.
 */

import { useCallback, useEffect, useState } from 'react';
import { Eye, Shield, Lock, Fingerprint, AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react';
import type { DashboardMaskingPolicy, DashboardPiiDistribution, DashboardMaskingStrategy } from '@/lib/api';
import {
  createMaskingPolicy,
  deleteMaskingPolicy,
  getMaskingPolicies,
  getPiiDistribution,
  getMaskingStrategies,
  updateMaskingPolicy,
} from '@/lib/api';
import { apiFetch } from '@/lib/api/client';
import Header from '@/components/header';
import { useAuth } from '@/lib/auth-context';

// Default sample text for the PII scanner
const SAMPLE_TEXT = `{
  "user": {
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "ssn": "123-45-6789",
    "phone": "555-867-5309"
  }
}`;

const PII_TYPES = ['email', 'phone', 'name', 'address', 'ssn', 'credit_card', 'ip_address', 'api_key', 'password', 'jwt_token'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ enabled }: { enabled: boolean }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${enabled ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>{enabled ? 'active' : 'disabled'}</span>;
}

function StrategyBadge({ strategy }: { strategy: string }) {
  const m: Record<string, string> = {
    redact: 'bg-red-500/20 text-red-400 border-red-500/30',
    partial: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    hash: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    tokenize: 'bg-green-500/20 text-green-400 border-green-500/30',
    generalize: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    suppress: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${m[strategy] ?? ''}`}>{strategy}</span>;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DataMaskingPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin';
  const [showScanner, setShowScanner] = useState(false);
  const [scanInput, setScanInput] = useState(SAMPLE_TEXT);
  const [scanOutput, setScanOutput] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policies, setPolicies] = useState<DashboardMaskingPolicy[]>([]);
  const [piiDistribution, setPiiDistribution] = useState<DashboardPiiDistribution[]>([]);
  const [strategies, setStrategies] = useState<DashboardMaskingStrategy[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [fieldPattern, setFieldPattern] = useState('*.email');
  const [piiType, setPiiType] = useState('email');
  const [strategy, setStrategy] = useState<DashboardMaskingPolicy['strategy']>('redact');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [pol, pii, strat] = await Promise.all([
      getMaskingPolicies(),
      getPiiDistribution(),
      getMaskingStrategies(),
    ]);
    setPolicies(pol);
    setPiiDistribution(pii);
    setStrategies(strat);
  }, []);

  useEffect(() => {
    load().catch(() => { setError('Failed to load data masking configuration.'); }).finally(() => setLoading(false));
  }, [load]);

  async function createPolicy() {
    if (!fieldPattern.trim() || !piiType) return;
    setSaving(true);
    setError(null);
    try {
      await createMaskingPolicy({ fieldPattern: fieldPattern.trim(), piiType, strategy, enabled: true, reason: reason.trim() });
      setShowCreate(false);
      setReason('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to create the masking policy.');
    } finally {
      setSaving(false);
    }
  }

  async function togglePolicy(policy: DashboardMaskingPolicy) {
    setSaving(true);
    setError(null);
    try {
      await updateMaskingPolicy(policy.id, { enabled: !policy.enabled });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to update the masking policy.');
    } finally {
      setSaving(false);
    }
  }

  async function removePolicy(id: string) {
    setSaving(true);
    setError(null);
    try {
      await deleteMaskingPolicy(id);
      setDeleteCandidateId(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete the masking policy.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-accent)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <Header title="Data Masking & PII Controls" subtitle="Manage persisted masking policies and test the built-in PII redaction engine" />
      <div className="space-y-6 px-4 sm:px-6">

      <div className="flex justify-end">
        {canManage && (
          <button type="button" onClick={() => setShowCreate((open) => !open)} className="inline-flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white">
            <Plus className="h-4 w-4" /> New policy
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}

      {showCreate && canManage && (
        <div className="glass-card rounded-2xl p-5">
          <h2 className="text-base font-semibold text-text-primary">Create masking policy</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs text-text-secondary">Field path pattern
              <input value={fieldPattern} onChange={(event) => setFieldPattern(event.target.value)} placeholder="*.email" className="mt-1 w-full rounded-lg px-3 py-2 font-mono text-sm" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }} />
            </label>
            <label className="text-xs text-text-secondary">PII type
              <select value={piiType} onChange={(event) => setPiiType(event.target.value)} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
                {PII_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
            <label className="text-xs text-text-secondary">Masking strategy
              <select value={strategy} onChange={(event) => setStrategy(event.target.value as DashboardMaskingPolicy['strategy'])} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
                {strategies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-text-secondary">Reason (optional)
              <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why this field must be protected" className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }} />
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg px-4 py-2 text-sm text-text-secondary">Cancel</button>
            <button type="button" onClick={() => void createPolicy()} disabled={!fieldPattern.trim() || saving} className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create policy'}</button>
          </div>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Policies', value: policies.filter(p => p.enabled).length, icon: Shield },
          { label: 'Classified Policies', value: piiDistribution.reduce((a, d) => a + d.count, 0).toLocaleString(), icon: Fingerprint },
          { label: 'Strategies', value: strategies.length, icon: Lock },
          { label: 'Disabled Policies', value: policies.filter(p => !p.enabled).length, icon: AlertTriangle },
        ].map(k => (
          <div key={k.label} className="glass-card rounded-xl p-4">
            <p className="text-xs text-text-tertiary uppercase">{k.label}</p>
            <p className="text-2xl font-bold text-text-primary">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Masking Policy Table */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
          <h2 className="text-lg font-semibold text-text-primary">Masking Policies</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-text-tertiary text-xs uppercase">
              <th scope="col" className="pb-3">Field Pattern</th><th scope="col" className="pb-3">PII Type</th><th scope="col" className="pb-3">Strategy</th><th scope="col" className="pb-3">Status</th><th scope="col" className="pb-3">Reason</th><th scope="col" className="pb-3">Created</th>{canManage && <th scope="col" className="pb-3">Actions</th>}
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {policies.length === 0 && <tr><td colSpan={canManage ? 7 : 6} className="py-8 text-center text-text-secondary">No masking policies are configured.</td></tr>}
              {policies.map(p => (
                <tr key={p.id} className="hover:bg-white/5">
                  <td className="py-3 font-mono text-sm text-text-primary">{p.fieldPattern}</td>
                  <td className="py-3 text-text-secondary">{p.piiType}</td>
                  <td className="py-3"><StrategyBadge strategy={p.strategy} /></td>
                  <td className="py-3"><StatusBadge enabled={p.enabled} /></td>
                  <td className="max-w-56 truncate py-3 text-text-secondary">{p.reason || '—'}</td>
                  <td className="py-3 text-xs text-text-secondary">{new Date(p.createdAt).toLocaleDateString()}</td>
                  {canManage && <td className="py-3">
                    {deleteCandidateId === p.id ? (
                      <div className="flex items-center gap-2"><button type="button" onClick={() => void removePolicy(p.id)} disabled={saving} className="rounded bg-red-500/15 px-2 py-1 text-xs text-red-400">Confirm</button><button type="button" onClick={() => setDeleteCandidateId(null)} className="text-xs text-text-secondary">Cancel</button></div>
                    ) : (
                      <div className="flex items-center gap-2"><button type="button" onClick={() => void togglePolicy(p)} disabled={saving} className="rounded bg-white/5 px-2 py-1 text-xs text-text-secondary">{p.enabled ? 'Disable' : 'Enable'}</button><button type="button" onClick={() => setDeleteCandidateId(p.id)} className="rounded p-1.5 text-red-400 hover:bg-red-500/10" title="Delete policy"><Trash2 className="h-3.5 w-3.5" /></button></div>
                    )}
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Policy distribution */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Fingerprint className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
          <h2 className="text-lg font-semibold text-text-primary">Policy Distribution by PII Type</h2>
        </div>
        {/* Bar */}
        <div className="flex h-4 rounded-full overflow-hidden mb-4">
          {piiDistribution.length === 0 && <div className="w-full bg-white/5" title="No policies configured" />}
          {piiDistribution.map((d, index) => (
            <div key={d.category} className={['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'][index % 5]} style={{ width: `${d.percentage}%` }} title={`${d.category}: ${d.percentage}%`} />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {piiDistribution.length === 0 && <p className="col-span-full text-sm text-text-secondary">Create a policy to populate this distribution.</p>}
          {piiDistribution.map((d, index) => (
            <div key={d.category} className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'][index % 5]}`} />
              <span className="text-xs text-text-secondary">{d.category.replaceAll('_', ' ')}</span>
              <span className="text-xs text-text-tertiary ml-auto">{d.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Strategy Cards */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
          <h2 className="text-lg font-semibold text-text-primary">Masking Strategies</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {strategies.map(s => (
            <div key={s.name} className="p-4 rounded-xl" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
              <h3 className="text-sm font-semibold text-text-primary mb-1">{s.name}</h3>
              <p className="text-xs text-text-secondary mb-3">{s.description}</p>
              <p className="text-[11px] font-mono text-text-tertiary">{s.id}</p>
            </div>
          ))}
        </div>
      </div>

      {/* PII Scanner */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
            <h2 className="text-lg font-semibold text-text-primary">PII Scanner</h2>
          </div>
          <button onClick={() => setShowScanner(!showScanner)}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ background: 'var(--color-accent)' }}>
            {showScanner ? 'Hide' : 'Open Scanner'}
          </button>
        </div>
        {showScanner && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-text-tertiary uppercase mb-2">Input Text</p>
              <textarea
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                rows={6}
                className="w-full p-3 rounded-lg text-xs font-mono text-text-secondary focus:outline-none focus:ring-2"
                style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
                placeholder="Paste text containing PII to mask..."
                aria-label="Input text containing PII to mask"
              />
            </div>
            <button
              onClick={async () => {
                setScanning(true);
                try {
                  const result = await apiFetch<{ masked: string }>('/api/v1/data-masking/mask', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: scanInput, strategy: 'redact' }),
                  });
                  setScanOutput(result.masked);
                } catch {
                  setScanOutput('[Error: could not reach masking API]');
                } finally {
                  setScanning(false);
                }
              }}
              disabled={scanning || !scanInput.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: scanning ? 'var(--color-border)' : 'var(--color-accent)', opacity: scanning ? 0.6 : 1 }}
            >
              {scanning ? 'Scanning…' : 'Run Masking Scan'}
            </button>
            {scanOutput !== null && (
              <div>
                <p className="text-xs text-text-tertiary uppercase mb-2">Masked Output</p>
                <pre className="p-3 rounded-lg text-xs font-mono text-green-400 overflow-auto" style={{ background: 'var(--color-base)' }}>{scanOutput}</pre>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
