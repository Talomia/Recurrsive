'use client';

/**
 * Secret Management page.
 *
 * Lists secrets with masked values, rotation status, backend badges, and audit log.
 */

import { useState, useEffect } from 'react';
import { Key, Lock, RefreshCcw, Shield, AlertTriangle } from 'lucide-react';

interface Secret {
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

interface AuditEntry {
  id: string;
  secretKey: string;
  action: 'rotated' | 'created' | 'accessed' | 'deleted';
  actor: string;
  timestamp: string;
}

const demoSecrets: Secret[] = [
  { id: 's1', key: 'DATABASE_URL', backend: 'vault', version: 5, createdAt: '2025-11-01', lastRotated: '2026-06-28', rotationDays: 3, maxAgeDays: 30, status: 'current', usedBy: ['api-server', 'worker'] },
  { id: 's2', key: 'AWS_ACCESS_KEY_ID', backend: 'aws', version: 3, createdAt: '2026-01-15', lastRotated: '2026-06-15', rotationDays: 16, maxAgeDays: 30, status: 'expiring', usedBy: ['s3-uploader'] },
  { id: 's3', key: 'STRIPE_SECRET_KEY', backend: 'vault', version: 2, createdAt: '2026-02-01', lastRotated: '2026-04-10', rotationDays: 82, maxAgeDays: 60, status: 'needs_rotation', usedBy: ['billing-svc'] },
  { id: 's4', key: 'AZURE_STORAGE_KEY', backend: 'azure', version: 4, createdAt: '2025-12-01', lastRotated: '2026-06-25', rotationDays: 6, maxAgeDays: 90, status: 'current', usedBy: ['blob-worker'] },
  { id: 's5', key: 'JWT_SIGNING_KEY', backend: 'local', version: 1, createdAt: '2026-03-01', lastRotated: '2026-03-01', rotationDays: 122, maxAgeDays: 90, status: 'needs_rotation', usedBy: ['auth-service'] },
  { id: 's6', key: 'SENDGRID_API_KEY', backend: 'local', version: 2, createdAt: '2026-01-10', lastRotated: '2026-06-20', rotationDays: 11, maxAgeDays: 60, status: 'current', usedBy: ['mailer'] },
];

const demoAudit: AuditEntry[] = [
  { id: 'a1', secretKey: 'DATABASE_URL', action: 'rotated', actor: 'auto-rotator', timestamp: '2026-06-28T14:30:00Z' },
  { id: 'a2', secretKey: 'AZURE_STORAGE_KEY', action: 'rotated', actor: 'admin@recurrsive.dev', timestamp: '2026-06-25T09:15:00Z' },
  { id: 'a3', secretKey: 'SENDGRID_API_KEY', action: 'rotated', actor: 'admin@recurrsive.dev', timestamp: '2026-06-20T11:00:00Z' },
  { id: 'a4', secretKey: 'AWS_ACCESS_KEY_ID', action: 'accessed', actor: 's3-uploader', timestamp: '2026-06-18T08:45:00Z' },
  { id: 'a5', secretKey: 'STRIPE_SECRET_KEY', action: 'accessed', actor: 'billing-svc', timestamp: '2026-06-15T16:20:00Z' },
];

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
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setSecrets(demoSecrets);
      setAudit(demoAudit);
      setLoading(false);
    }, 300);
  }, []);

  const needsRotation = secrets.filter(s => s.status === 'needs_rotation').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-accent)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Key className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
            Secrets
          </h1>
          <p className="text-sm text-text-secondary mt-1">{secrets.length} secrets managed</p>
        </div>
        {needsRotation > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">{needsRotation} secret{needsRotation > 1 ? 's' : ''} need rotation</span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {['vault', 'aws', 'azure', 'local'].map(backend => {
          const count = secrets.filter(s => s.backend === backend).length;
          return (
            <div key={backend} className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
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
      <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Secret Inventory
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-tertiary text-xs border-b" style={{ borderColor: 'var(--color-border)' }}>
                <th className="pb-2 font-medium">Key</th>
                <th className="pb-2 font-medium">Value</th>
                <th className="pb-2 font-medium">Backend</th>
                <th className="pb-2 font-medium">Version</th>
                <th className="pb-2 font-medium">Age (days)</th>
                <th className="pb-2 font-medium">Rotation Status</th>
                <th className="pb-2 font-medium">Used By</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
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
                    <button className="p-1.5 rounded-lg transition-all hover:opacity-80" style={{ background: 'var(--color-base)' }}>
                      <RefreshCcw className="w-3.5 h-3.5 text-text-tertiary" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rotation Audit Log */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <RefreshCcw className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Rotation Audit Log
        </h3>
        <div className="space-y-2">
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
      </div>
    </div>
  );
}
