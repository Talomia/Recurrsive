'use client';
/**
 * Multi-Tenant Management page.
 *
 * Tenant list, tier badges, quota usage bars, feature comparison, and create form.
 */

import { useState, useEffect } from 'react';
import { Building2, Users, CreditCard, Shield, BarChart3 } from 'lucide-react';
import Header from '@/components/header';
import LoadingSkeleton from '@/components/loading-skeleton';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/format';
import { getTenants, createTenant, deleteTenant } from '@/lib/api';
import type { DashboardTenant } from '@/lib/api';

// Mirrors the server's real tierQuotas / tierFeatures
// (apps/server/src/routes/multi-tenant.ts). No fabricated rows (e.g. SLA,
// which the tenant model does not define).
const featureMatrix = [
  { feature: 'Projects', free: '3', team: '20', enterprise: 'Unlimited' },
  { feature: 'Users', free: '5', team: '50', enterprise: 'Unlimited' },
  { feature: 'Analysis runs / day', free: '10', team: '100', enterprise: 'Unlimited' },
  { feature: 'Storage', free: '500 MB', team: '5 GB', enterprise: '50 GB' },
  { feature: 'Data retention', free: '30 days', team: '90 days', enterprise: '365 days' },
  { feature: 'API Access', free: '✓', team: '✓', enterprise: '✓' },
  { feature: 'SSO', free: '—', team: '✓', enterprise: '✓' },
  { feature: 'Webhooks', free: '—', team: '✓', enterprise: '✓' },
  { feature: 'Advanced reporting', free: '—', team: '✓', enterprise: '✓' },
  { feature: 'Audit log', free: '—', team: '✓', enterprise: '✓' },
  { feature: 'Custom branding', free: '—', team: '—', enterprise: '✓' },
  { feature: 'Multi-region', free: '—', team: '—', enterprise: '✓' },
];

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    free: 'bg-gray-500/20 text-gray-400',
    team: 'bg-blue-500/20 text-blue-400',
    enterprise: 'bg-purple-500/20 text-purple-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[tier]}`}>{tier}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    trial: 'bg-yellow-500/20 text-yellow-400',
    suspended: 'bg-red-500/20 text-red-400',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status]}`}>{status}</span>;
}

function QuotaBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min((used / max) * 100, 100);
  const color = pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-yellow-400' : 'bg-green-400';
  return (
    <div className="flex-1">
      <div className="flex justify-between text-xs text-text-tertiary mb-1">
        <span>{label}</span>
        <span>{used}/{max}</span>
      </div>
      <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--color-border)' }}>
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function TenantsPage() {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<DashboardTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTier, setNewTier] = useState<string>('free');
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardTenant | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async () => {
    try {
      setError(null);
      const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await createTenant({ name: newName, slug, tier: newTier });
      setShowCreate(false);
      setNewName('');
      setNewTier('free');
      const data = await getTenants();
      setTenants(data);
      toast('Tenant created.', 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create tenant');
      toast('Failed to create tenant.', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      setError(null);
      await deleteTenant(deleteTarget.id);
      const data = await getTenants();
      setTenants(data);
      toast(`Tenant "${deleteTarget.name}" deleted.`, 'info');
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete tenant');
      toast('Failed to delete tenant.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    getTenants()
      .then(setTenants)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load tenants.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Multi-Tenant Management" subtitle="Manage tenants, tiers, and resource quotas" />
        <LoadingSkeleton variant="list" count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header title="Multi-Tenant Management" subtitle="Manage tenants, tiers, and resource quotas" />
      <div className="flex items-center justify-end">
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ background: 'var(--color-accent)' }}>
          <Building2 className="w-4 h-4" /> New Tenant
        </button>
      </div>

      {/* Create Form */}
      {/* Error Banner */}
      {error && (
        <div className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/30 flex items-center justify-between">
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-300">Dismiss</button>
        </div>
      )}

      {showCreate && (
        <div className="glass-card rounded-2xl p-5">
          <h2 className="text-base font-semibold text-text-primary mb-3">New Tenant</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Tenant Name" aria-label="Tenant Name" value={newName} onChange={e => setNewName(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            <select value={newTier} onChange={e => setNewTier(e.target.value)} aria-label="Tenant tier" className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>
              <option value="free">Free</option>
              <option value="team">Team</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-text-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={!newName} className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ background: newName ? 'var(--color-accent)' : 'var(--color-border)', opacity: newName ? 1 : 0.5 }}>
              Create
            </button>
          </div>
        </div>
      )}

      {/* Tier Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['free', 'team', 'enterprise'] as const).map(tier => {
          const count = tenants.filter(t => t.tier === tier).length;
          const icons = { free: Users, team: CreditCard, enterprise: Shield };
          const Icon = icons[tier];
          return (
            <div key={tier} className="glass-card rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <TierBadge tier={tier} />
                <Icon className="w-4 h-4 text-text-tertiary" />
              </div>
              <p className="text-2xl font-bold text-text-primary mt-2">{count}</p>
              <p className="text-xs text-text-tertiary">{tier} tenants</p>
            </div>
          );
        })}
      </div>

      {/* Tenant List */}
      <div className="space-y-3">
        {tenants.length === 0 && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <p className="text-sm text-text-secondary">No tenants yet. Create one to start multi-tenant management.</p>
          </div>
        )}
        {tenants.map(tenant => (
          <div key={tenant.id} className="glass-card rounded-2xl p-5 transition-all hover:scale-[1.005]">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-text-primary">{tenant.name}</h2>
                  <TierBadge tier={tenant.tier} />
                  <StatusBadge status={tenant.status} />
                </div>
                <p className="text-xs text-text-tertiary mt-0.5">{tenant.slug} · {tenant.owner} · Created {formatDate(tenant.createdAt)}</p>
              </div>
              <button onClick={() => setDeleteTarget(tenant)} className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded" title="Delete tenant" aria-label={`Delete tenant ${tenant.name}`}>Delete</button>
            </div>
            <div className="flex items-center gap-6">
              <QuotaBar label="Projects" used={tenant.quotas.projects.used} max={tenant.quotas.projects.max} />
              <QuotaBar label="Users" used={tenant.quotas.users.used} max={tenant.quotas.users.max} />
              <QuotaBar label={`Storage (MB)`} used={tenant.quotas.storageMb.used} max={tenant.quotas.storageMb.max} />
            </div>
          </div>
        ))}
      </div>

      {/* Feature Comparison */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Feature Comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-tertiary text-xs border-b" style={{ borderColor: 'var(--color-border)' }}>
                <th scope="col" className="pb-2 font-medium">Feature</th>
                <th scope="col" className="pb-2 font-medium text-center">Free</th>
                <th scope="col" className="pb-2 font-medium text-center">Team</th>
                <th scope="col" className="pb-2 font-medium text-center">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {featureMatrix.map(row => (
                <tr key={row.feature} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="py-2 text-text-primary">{row.feature}</td>
                  <td className="py-2 text-text-tertiary text-center">{row.free}</td>
                  <td className="py-2 text-text-secondary text-center">{row.team}</td>
                  <td className="py-2 text-text-primary text-center font-medium">{row.enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete tenant"
        destructive
        loading={deleting}
        confirmLabel="Delete"
        message={
          <>
            Are you sure you want to delete{' '}
            <span className="font-semibold text-text-primary">{deleteTarget?.name}</span>? This removes the
            tenant and its associated quotas. This action cannot be undone.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />
    </div>
  );
}
