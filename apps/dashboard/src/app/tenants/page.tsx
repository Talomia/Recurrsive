'use client';

/**
 * Multi-Tenant Management page.
 *
 * Tenant list, tier badges, quota usage bars, feature comparison, and create form.
 */

import { useState, useEffect } from 'react';
import { Building2, Users, CreditCard, Shield, BarChart3 } from 'lucide-react';

interface Tenant {
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

const demoTenants: Tenant[] = [
  { id: 't1', name: 'Acme Corp', slug: 'acme', tier: 'enterprise', status: 'active', createdAt: '2025-06-01', owner: 'ceo@acme.com', quotas: { projects: { used: 24, max: 100 }, users: { used: 87, max: 500 }, storageMb: { used: 4200, max: 10240 } } },
  { id: 't2', name: 'StartupIO', slug: 'startupio', tier: 'team', status: 'active', createdAt: '2026-01-15', owner: 'founder@startupio.com', quotas: { projects: { used: 8, max: 20 }, users: { used: 12, max: 50 }, storageMb: { used: 850, max: 2048 } } },
  { id: 't3', name: 'DevShop', slug: 'devshop', tier: 'free', status: 'active', createdAt: '2026-04-01', owner: 'dev@devshop.io', quotas: { projects: { used: 2, max: 3 }, users: { used: 3, max: 5 }, storageMb: { used: 120, max: 512 } } },
  { id: 't4', name: 'MegaTech', slug: 'megatech', tier: 'enterprise', status: 'trial', createdAt: '2026-06-15', owner: 'it@megatech.co', quotas: { projects: { used: 5, max: 100 }, users: { used: 15, max: 500 }, storageMb: { used: 300, max: 10240 } } },
  { id: 't5', name: 'Indie Dev', slug: 'indiedev', tier: 'free', status: 'suspended', createdAt: '2026-02-20', owner: 'solo@indiedev.xyz', quotas: { projects: { used: 3, max: 3 }, users: { used: 1, max: 5 }, storageMb: { used: 510, max: 512 } } },
];

const featureMatrix = [
  { feature: 'Projects', free: '3', team: '20', enterprise: 'Unlimited' },
  { feature: 'Users', free: '5', team: '50', enterprise: '500+' },
  { feature: 'Storage', free: '512 MB', team: '2 GB', enterprise: '10 GB+' },
  { feature: 'SSO', free: '—', team: '✓', enterprise: '✓' },
  { feature: 'API Access', free: '—', team: '✓', enterprise: '✓' },
  { feature: 'Custom Plugins', free: '—', team: '—', enterprise: '✓' },
  { feature: 'SLA', free: '—', team: '99.5%', enterprise: '99.9%' },
  { feature: 'Priority Support', free: '—', team: '—', enterprise: '✓' },
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
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTier, setNewTier] = useState<string>('free');

  useEffect(() => {
    setTimeout(() => {
      setTenants(demoTenants);
      setLoading(false);
    }, 300);
  }, []);

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
            <Building2 className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
            Tenants
          </h1>
          <p className="text-sm text-text-secondary mt-1">{tenants.length} tenant{tenants.length !== 1 ? 's' : ''} managed</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ background: 'var(--color-accent)' }}>
          <Building2 className="w-4 h-4" /> New Tenant
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-base font-semibold text-text-primary mb-3">Create New Tenant</h3>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Tenant Name" value={newName} onChange={e => setNewName(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            <select value={newTier} onChange={e => setNewTier(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>
              <option value="free">Free</option>
              <option value="team">Team</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-text-secondary">Cancel</button>
            <button disabled={!newName} className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ background: newName ? 'var(--color-accent)' : 'var(--color-border)', opacity: newName ? 1 : 0.5 }}>
              Create
            </button>
          </div>
        </div>
      )}

      {/* Tier Summary */}
      <div className="grid grid-cols-3 gap-4">
        {(['free', 'team', 'enterprise'] as const).map(tier => {
          const count = tenants.filter(t => t.tier === tier).length;
          const icons = { free: Users, team: CreditCard, enterprise: Shield };
          const Icon = icons[tier];
          return (
            <div key={tier} className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
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
        {tenants.map(tenant => (
          <div key={tenant.id} className="rounded-2xl p-5 transition-all hover:scale-[1.005]" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-text-primary">{tenant.name}</h3>
                  <TierBadge tier={tenant.tier} />
                  <StatusBadge status={tenant.status} />
                </div>
                <p className="text-xs text-text-tertiary mt-0.5">{tenant.slug} · {tenant.owner} · Created {new Date(tenant.createdAt).toLocaleDateString()}</p>
              </div>
              <BarChart3 className="w-5 h-5 text-text-tertiary" />
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
      <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Feature Comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-tertiary text-xs border-b" style={{ borderColor: 'var(--color-border)' }}>
                <th className="pb-2 font-medium">Feature</th>
                <th className="pb-2 font-medium text-center">Free</th>
                <th className="pb-2 font-medium text-center">Team</th>
                <th className="pb-2 font-medium text-center">Enterprise</th>
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
    </div>
  );
}
