'use client';
/**
 * Secret Management page.
 *
 * Lists encrypted local secrets with masked values, rotation status, and audit history.
 */

import { useCallback, useEffect, useState } from 'react';
import { Lock, RefreshCcw, Shield, AlertTriangle, Loader2, Trash2, Plus } from 'lucide-react';
import Header from '@/components/header';
import type { DashboardSecret, DashboardAuditEntry } from '@/lib/api';
import { getSecrets, getSecretAuditLog, createSecret, deleteSecret, rotateSecret } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function BackendBadge({ backend }: { backend: string }) {
  const colors: Record<string, string> = {
    local: 'bg-gray-500/20 text-gray-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[backend] ?? 'bg-gray-500/20 text-gray-400'}`}>{backend}</span>;
}

function RotationBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    current: 'bg-green-500/20 text-green-400 border-green-500/30',
    expiring: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    needs_rotation: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  const labels: Record<string, string> = { current: 'Current', expiring: 'Expiring Soon', needs_rotation: 'Needs Rotation' };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium border ${styles[status]}`}>{labels[status]}</span>;
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    rotated: 'bg-green-500/20 text-green-400',
    created: 'bg-blue-500/20 text-blue-400',
    read: 'bg-gray-500/20 text-gray-400',
    updated: 'bg-amber-500/20 text-amber-400',
    deleted: 'bg-red-500/20 text-red-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[action] ?? colors.read}`}>{action}</span>;
}

function ageInDays(secret: DashboardSecret): number {
  const baseline = secret.lastRotated ?? secret.createdAt;
  return Math.max(0, Math.floor((Date.now() - new Date(baseline).getTime()) / 86_400_000));
}

function rotationStatus(secret: DashboardSecret): 'current' | 'expiring' | 'needs_rotation' {
  const expiresInDays = secret.expiresAt
    ? Math.ceil((new Date(secret.expiresAt).getTime() - Date.now()) / 86_400_000)
    : null;
  if (expiresInDays !== null && expiresInDays <= 0) return 'needs_rotation';
  if (expiresInDays !== null && expiresInDays <= 7) return 'expiring';
  if (secret.rotationIntervalDays <= 0) return 'current';
  const remaining = secret.rotationIntervalDays - ageInDays(secret);
  if (remaining <= 0) return 'needs_rotation';
  return remaining <= Math.min(7, Math.ceil(secret.rotationIntervalDays * 0.2)) ? 'expiring' : 'current';
}

export default function SecretsPage() {
  const { user, loading: authLoading } = useAuth();
  const canView = user?.role === 'admin' || user?.role === 'analyst';
  const canManage = user?.role === 'admin';
  const [secrets, setSecrets] = useState<DashboardSecret[]>([]);
  const [audit, setAudit] = useState<DashboardAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newRotationDays, setNewRotationDays] = useState('0');
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [rotationValue, setRotationValue] = useState('');
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reloadData = useCallback(async () => {
    const [s, a] = await Promise.all([
      getSecrets(),
      canManage ? getSecretAuditLog() : Promise.resolve([]),
    ]);
    setSecrets(s);
    setAudit(a);
  }, [canManage]);

  useEffect(() => {
    if (!user || !canView) {
      if (!authLoading) setLoading(false);
      return;
    }
    setLoading(true);
    reloadData()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load secrets.'))
      .finally(() => setLoading(false));
  }, [user, authLoading, canView, reloadData]);

  const handleCreate = async () => {
    try {
      setSaving(true);
      setError(null);
      const tags = newTags.trim() ? newTags.split(',').map(t => t.trim()).filter(Boolean) : [];
      await createSecret({
        key: newKey,
        value: newValue,
        description: newDescription || undefined,
        tags: tags.length > 0 ? tags : undefined,
        rotationIntervalDays: Number(newRotationDays) || 0,
      });
      setShowCreate(false);
      setNewKey('');
      setNewValue('');
      setNewDescription('');
      setNewTags('');
      setNewRotationDays('0');
      await reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create secret');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setSaving(true);
      setError(null);
      await deleteSecret(id);
      setDeleteCandidateId(null);
      await reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete secret');
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = async () => {
    if (!rotatingId || !rotationValue) return;
    try {
      setSaving(true);
      setError(null);
      await rotateSecret(rotatingId, rotationValue);
      setRotatingId(null);
      setRotationValue('');
      await reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rotate secret');
    } finally {
      setSaving(false);
    }
  };

  const needsRotation = secrets.filter((secret) => rotationStatus(secret) === 'needs_rotation').length;
  const automaticRotation = secrets.filter((secret) => secret.rotationIntervalDays > 0).length;

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-accent)' }} />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 pt-16 text-center lg:pt-0">
        <div>
          <Lock className="mx-auto mb-4 h-10 w-10 text-text-tertiary" />
          <h1 className="text-lg font-semibold text-text-primary">Access denied</h1>
          <p className="mt-2 text-sm text-text-secondary">Analyst or administrator access is required to view secret metadata.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <Header title="Secrets & Credentials" subtitle="Store encrypted application credentials and track rotation metadata" />
      <div className="space-y-6 px-4 sm:px-6">
      <div className="flex items-center justify-end gap-3">
        {needsRotation > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">{needsRotation} secret{needsRotation > 1 ? 's' : ''} need rotation</span>
          </div>
        )}
        {canManage && (
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ background: 'var(--color-accent)' }}>
            <Plus className="w-4 h-4" /> New Secret
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/30 flex items-center justify-between">
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-300">Dismiss</button>
        </div>
      )}

      {/* Create Secret Form */}
      {showCreate && (
        <div className="glass-card rounded-2xl p-5">
          <h2 className="text-base font-semibold text-text-primary mb-3">Create New Secret</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input placeholder="Secret Key (e.g. API_KEY)" aria-label="Secret Key" value={newKey} onChange={e => setNewKey(e.target.value)} className="px-3 py-2 rounded-lg text-sm font-mono" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            <input placeholder="Secret Value" aria-label="Secret Value" type="password" value={newValue} onChange={e => setNewValue(e.target.value)} className="px-3 py-2 rounded-lg text-sm font-mono" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            <input placeholder="Description (optional)" aria-label="Description" value={newDescription} onChange={e => setNewDescription(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            <input placeholder="Tags (comma-separated, optional)" aria-label="Tags" value={newTags} onChange={e => setNewTags(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            <label className="text-xs text-text-secondary">
              Rotation interval (days; 0 for manual)
              <input type="number" min="0" max="3650" value={newRotationDays} onChange={(event) => setNewRotationDays(event.target.value)} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-text-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={!newKey || !newValue || saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:cursor-not-allowed" style={{ background: newKey && newValue ? 'var(--color-accent)' : 'var(--color-border)', opacity: newKey && newValue && !saving ? 1 : 0.5 }}>
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {rotatingId && (
        <div className="glass-card rounded-2xl p-5" role="region" aria-labelledby="rotate-secret-title">
          <h2 id="rotate-secret-title" className="text-base font-semibold text-text-primary">Rotate secret</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Enter a replacement value for <span className="font-mono text-text-primary">{secrets.find((secret) => secret.id === rotatingId)?.key}</span>. The current value cannot be recovered.
          </p>
          <input
            autoFocus
            type="password"
            aria-label="Replacement secret value"
            value={rotationValue}
            onChange={(event) => setRotationValue(event.target.value)}
            className="mt-4 w-full rounded-lg px-3 py-2 font-mono text-sm"
            style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
          />
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => { setRotatingId(null); setRotationValue(''); }} className="rounded-lg px-4 py-2 text-sm text-text-secondary">Cancel</button>
            <button type="button" onClick={() => void handleRotate()} disabled={!rotationValue || saving} className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {saving ? 'Rotating…' : 'Rotate value'}
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between"><BackendBadge backend="local" /><Lock className="h-4 w-4 text-text-tertiary" /></div>
          <p className="mt-2 text-2xl font-bold text-text-primary">{secrets.length}</p>
          <p className="text-xs text-text-tertiary">encrypted local secrets</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">Rotation due</p>
          <p className={`mt-2 text-2xl font-bold ${needsRotation ? 'text-red-400' : 'text-text-primary'}`}>{needsRotation}</p>
          <p className="text-xs text-text-tertiary">based on stored rotation metadata</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">Scheduled policy</p>
          <p className="mt-2 text-2xl font-bold text-text-primary">{automaticRotation}</p>
          <p className="text-xs text-text-tertiary">with a rotation interval configured</p>
        </div>
      </div>

      {/* Secrets Table */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Secret Inventory
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-tertiary text-xs border-b" style={{ borderColor: 'var(--color-border)' }}>
                <th scope="col" className="pb-2 font-medium">Key</th>
                <th scope="col" className="pb-2 font-medium">Description</th>
                <th scope="col" className="pb-2 font-medium">Backend</th>
                <th scope="col" className="pb-2 font-medium">Version</th>
                <th scope="col" className="pb-2 font-medium">Age (days)</th>
                <th scope="col" className="pb-2 font-medium">Rotation Status</th>
                <th scope="col" className="pb-2 font-medium">Tags</th>
                {canManage && <th scope="col" className="pb-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {secrets.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 8 : 7} className="py-8 text-center text-sm text-text-secondary">
                    {canManage ? 'No secrets stored yet. Add one using the form above.' : 'No secrets stored yet.'}
                  </td>
                </tr>
              )}
              {secrets.map(secret => (
                <tr key={secret.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="py-3 font-mono text-text-primary text-xs">{secret.key}</td>
                  <td className="max-w-48 truncate py-3 text-xs text-text-tertiary">{secret.description || '—'}</td>
                  <td className="py-3"><BackendBadge backend={secret.backend} /></td>
                  <td className="py-3 text-text-secondary">v{secret.version}</td>
                  <td className="py-3 text-text-secondary">{ageInDays(secret)}d</td>
                  <td className="py-3"><RotationBadge status={rotationStatus(secret)} /></td>
                  <td className="max-w-48 py-3 text-xs text-text-tertiary">{secret.tags.length ? secret.tags.join(', ') : '—'}</td>
                  {canManage && (
                    <td className="py-3">
                      {deleteCandidateId === secret.id ? (
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => void handleDelete(secret.id)} disabled={saving} className="rounded-md bg-red-500/15 px-2 py-1 text-xs font-medium text-red-400 disabled:opacity-50">Confirm</button>
                          <button type="button" onClick={() => setDeleteCandidateId(null)} disabled={saving} className="rounded-md px-2 py-1 text-xs text-text-secondary">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => { setRotatingId(secret.id); setRotationValue(''); }} className="p-1.5 rounded-lg transition-all hover:opacity-80" style={{ background: 'var(--color-base)' }} title="Rotate secret">
                            <RefreshCcw className="w-3.5 h-3.5 text-text-tertiary" />
                          </button>
                          <button type="button" onClick={() => setDeleteCandidateId(secret.id)} className="p-1.5 rounded-lg transition-all hover:opacity-80 hover:bg-red-500/10" style={{ background: 'var(--color-base)' }} title="Delete secret">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rotation Audit Log */}
      {canManage && <div className="glass-card rounded-2xl p-5">
        <h2 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <RefreshCcw className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Rotation Audit Log
        </h2>
        <div className="space-y-2">
          {audit.length === 0 && <p className="py-4 text-center text-sm text-text-secondary">No secret activity has been recorded.</p>}
          {audit.map(entry => (
            <div key={entry.id} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-3">
                <ActionBadge action={entry.action} />
                <span className="text-sm font-mono text-text-primary">{entry.secretKey}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-tertiary">
                <span>{entry.actor}</span>
                <span>{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>}
      </div>
    </div>
  );
}
