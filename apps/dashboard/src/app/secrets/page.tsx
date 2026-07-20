'use client';
/**
 * Secret Management page.
 *
 * Lists secrets with masked values, rotation status, backend badges, and audit log.
 */

import { useState, useEffect } from 'react';
import { Lock, RefreshCcw, Shield, AlertTriangle, Trash2, Plus } from 'lucide-react';
import Header from '@/components/header';
import LoadingSkeleton from '@/components/loading-skeleton';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { formatDateTime } from '@/lib/format';
import type { DashboardSecret, DashboardAuditEntry } from '@/lib/api';
import { getSecrets, getSecretAuditLog, createSecret, deleteSecret, rotateSecret } from '@/lib/api';

function BackendBadge({ backend }: { backend: string }) {
  const colors: Record<string, string> = {
    vault: 'bg-purple-500/20 text-purple-400',
    aws: 'bg-orange-500/20 text-orange-400',
    azure: 'bg-blue-500/20 text-blue-400',
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
    accessed: 'bg-gray-500/20 text-gray-400',
    deleted: 'bg-red-500/20 text-red-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[action]}`}>{action}</span>;
}

export default function SecretsPage() {
  const { toast } = useToast();
  const [secrets, setSecrets] = useState<DashboardSecret[]>([]);
  const [audit, setAudit] = useState<DashboardAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTags, setNewTags] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DashboardSecret | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reloadData = async () => {
    const [s, a] = await Promise.all([getSecrets(), getSecretAuditLog()]);
    setSecrets(s);
    setAudit(a);
  };

  useEffect(() => {
    reloadData()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load secrets.'))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    try {
      setError(null);
      const tags = newTags.trim() ? newTags.split(',').map(t => t.trim()).filter(Boolean) : [];
      await createSecret({ key: newKey, value: newValue, description: newDescription || undefined, tags: tags.length > 0 ? tags : undefined });
      setShowCreate(false);
      setNewKey('');
      setNewValue('');
      setNewDescription('');
      setNewTags('');
      await reloadData();
      toast('Secret created.', 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create secret');
      toast('Failed to create secret.', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      setError(null);
      await deleteSecret(deleteTarget.id);
      await reloadData();
      toast(`Secret "${deleteTarget.key}" deleted.`, 'info');
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete secret');
      toast('Failed to delete secret.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleRotate = async (id: string, key: string) => {
    try {
      setError(null);
      await rotateSecret(id);
      await reloadData();
      toast(`Secret "${key}" rotated.`, 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rotate secret');
      toast('Failed to rotate secret.', 'error');
    }
  };

  const needsRotation = secrets.filter(s => s.status === 'needs_rotation').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Secrets & Credentials" subtitle="Manage API keys, tokens, and sensitive configuration" />
        <LoadingSkeleton variant="table" count={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header title="Secrets & Credentials" subtitle="Manage API keys, tokens, and sensitive configuration" />
      <div className="flex items-center justify-end gap-3">
        {needsRotation > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">{needsRotation} secret{needsRotation > 1 ? 's' : ''} need rotation</span>
          </div>
        )}
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ background: 'var(--color-accent)' }}>
          <Plus className="w-4 h-4" /> New Secret
        </button>
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
          <h2 className="text-base font-semibold text-text-primary mb-3">New Secret</h2>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Secret Key (e.g. API_KEY)" aria-label="Secret Key" value={newKey} onChange={e => setNewKey(e.target.value)} className="px-3 py-2 rounded-lg text-sm font-mono" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            <input placeholder="Secret Value" aria-label="Secret Value" type="password" value={newValue} onChange={e => setNewValue(e.target.value)} className="px-3 py-2 rounded-lg text-sm font-mono" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            <input placeholder="Description (optional)" aria-label="Description" value={newDescription} onChange={e => setNewDescription(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            <input placeholder="Tags (comma-separated, optional)" aria-label="Tags" value={newTags} onChange={e => setNewTags(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-text-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={!newKey || !newValue} className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ background: newKey && newValue ? 'var(--color-accent)' : 'var(--color-border)', opacity: newKey && newValue ? 1 : 0.5 }}>
              Create
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {['vault', 'aws', 'azure', 'local'].map(backend => {
          const count = secrets.filter(s => s.backend === backend).length;
          return (
            <div key={backend} className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <BackendBadge backend={backend} />
                <Lock className="w-4 h-4 text-text-tertiary" />
              </div>
              <p className="text-2xl font-bold text-text-primary mt-2">{count}</p>
              <p className="text-xs text-text-tertiary">{backend} secrets</p>
            </div>
          );
        })}
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
                <th scope="col" className="pb-2 font-medium">Value</th>
                <th scope="col" className="pb-2 font-medium">Backend</th>
                <th scope="col" className="pb-2 font-medium">Version</th>
                <th scope="col" className="pb-2 font-medium">Age (days)</th>
                <th scope="col" className="pb-2 font-medium">Rotation Status</th>
                <th scope="col" className="pb-2 font-medium">Used By</th>
                <th scope="col" className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {secrets.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-text-secondary">
                    No secrets stored yet. Add one using the form above.
                  </td>
                </tr>
              )}
              {secrets.map(secret => (
                <tr key={secret.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="py-3 font-mono text-text-primary text-xs">{secret.key}</td>
                  <td className="py-3 font-mono text-text-tertiary text-xs">••••••••••••</td>
                  <td className="py-3"><BackendBadge backend={secret.backend} /></td>
                  <td className="py-3 text-text-secondary">v{secret.version}</td>
                  <td className="py-3 text-text-secondary">{secret.rotationDays}d</td>
                  <td className="py-3"><RotationBadge status={secret.status} /></td>
                  <td className="py-3 text-text-tertiary text-xs">{secret.usedBy.join(', ')}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleRotate(secret.id, secret.key)} className="p-1.5 rounded-lg transition-all hover:opacity-80" style={{ background: 'var(--color-base)' }} title="Rotate secret" aria-label={`Rotate secret ${secret.key}`}>
                        <RefreshCcw className="w-3.5 h-3.5 text-text-tertiary" aria-hidden="true" />
                      </button>
                      <button onClick={() => setDeleteTarget(secret)} className="p-1.5 rounded-lg transition-all hover:opacity-80 hover:bg-red-500/10" style={{ background: 'var(--color-base)' }} title="Delete secret" aria-label={`Delete secret ${secret.key}`}>
                        <Trash2 className="w-3.5 h-3.5 text-red-400" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rotation Audit Log */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <RefreshCcw className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Rotation Audit Log
        </h2>
        <div className="space-y-2">
          {audit.map(entry => (
            <div key={entry.id} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-3">
                <ActionBadge action={entry.action} />
                <span className="text-sm font-mono text-text-primary">{entry.secretKey}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-tertiary">
                <span>{entry.actor}</span>
                <span>{formatDateTime(entry.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete secret"
        destructive
        loading={deleting}
        confirmLabel="Delete"
        message={
          <>
            Are you sure you want to delete{' '}
            <span className="font-semibold text-text-primary font-mono">{deleteTarget?.key}</span>? Any service
            using this secret will lose access. This action cannot be undone.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />
    </div>
  );
}
