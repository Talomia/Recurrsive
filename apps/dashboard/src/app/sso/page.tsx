'use client';
/**
 * SSO Configuration page.
 *
 * Provider management, active sessions, and configuration form.
 */

import { useState, useEffect } from 'react';
import { Users, Shield, Globe, LogIn, Loader2 } from 'lucide-react';
import Header from '@/components/header';
import { getSSOProviders, getSSOSessions, createSsoProvider, deleteSsoProvider, revokeSsoSession } from '@/lib/api';
import type { SSOProvider, SSOSession } from '@/lib/api';

function ProviderStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    configured: 'bg-green-500/20 text-green-400 border-green-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium border ${styles[status]}`}>{status}</span>;
}

function ProviderIcon({ type }: { type: string }) {
  const colors: Record<string, string> = { okta: 'text-blue-400', auth0: 'text-orange-400', azure_ad: 'text-cyan-400', google: 'text-red-400' };
  return <Globe className={`w-5 h-5 ${colors[type] ?? 'text-gray-400'}`} />;
}

export default function SSOPage() {
  const [providers, setProviders] = useState<SSOProvider[]>([]);
  const [sessions, setSessions] = useState<SSOSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newType, setNewType] = useState<string>('okta');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSSOProviders(), getSSOSessions()])
      .then(([p, s]) => {
        setProviders(p);
        setSessions(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load SSO data.'))
      .finally(() => setLoading(false));
  }, []);

  const reloadData = async () => {
    const [p, s] = await Promise.all([getSSOProviders(), getSSOSessions()]);
    setProviders(p);
    setSessions(s);
  };

  const handleCreateProvider = async () => {
    try {
      setError(null);
      await createSsoProvider(newType, {
        provider: newType as 'okta' | 'auth0' | 'azure_ad' | 'google',
        displayName: newName,
        entityId: `https://${newDomain}/${newType}`,
        ssoUrl: `https://${newDomain}/${newType}/sso`,
      });
      setShowAdd(false);
      setNewName('');
      setNewDomain('');
      setNewType('okta');
      await reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create SSO provider');
    }
  };

  const handleDeleteProvider = async (id: string) => {
    try {
      setError(null);
      await deleteSsoProvider(id);
      await reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete SSO provider');
    }
  };

  const handleRevokeSession = async (id: string) => {
    try {
      setError(null);
      await revokeSsoSession(id);
      await reloadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke session');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-accent)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header title="Single Sign-On" subtitle="Configure identity providers for SSO authentication" />
      <div className="flex items-center justify-end">
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ background: 'var(--color-accent)' }}>
          <LogIn className="w-4 h-4" /> Add Provider
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/30 flex items-center justify-between">
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-300">Dismiss</button>
        </div>
      )}

      {/* Add Provider Form */}
      {showAdd && (
        <div className="glass-card rounded-2xl p-5">
          <h2 className="text-base font-semibold text-text-primary mb-3">Configure New SSO Provider</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input placeholder="Provider Name" aria-label="Provider Name" value={newName} onChange={e => setNewName(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            <input placeholder="Domain" aria-label="Domain" value={newDomain} onChange={e => setNewDomain(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            <select value={newType} onChange={e => setNewType(e.target.value)} aria-label="Identity provider type" className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>
              <option value="okta">Okta</option>
              <option value="auth0">Auth0</option>
              <option value="azure_ad">Azure AD</option>
              <option value="google">Google Workspace</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm text-text-secondary">Cancel</button>
            <button onClick={handleCreateProvider} disabled={!newName || !newDomain} className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ background: newName && newDomain ? 'var(--color-accent)' : 'var(--color-border)', opacity: newName && newDomain ? 1 : 0.5 }}>
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* SSO Providers */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Identity Providers
        </h2>
        <div className="space-y-3">
          {providers.length === 0 && (
            <div className="rounded-xl p-6 text-center" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
              <p className="text-sm text-text-secondary">No identity providers configured yet.</p>
            </div>
          )}
          {providers.map(provider => (
            <div key={provider.id} className="flex items-center justify-between rounded-xl p-4" style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-3">
                <ProviderIcon type={provider.type} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{provider.name}</span>
                    <ProviderStatusBadge status={provider.status} />
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-500/20 text-gray-400">{provider.protocol}</span>
                  </div>
                  <p className="text-xs text-text-tertiary mt-0.5">{provider.domain}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-text-tertiary">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {provider.usersCount} users</span>
                {provider.lastSync && <span>Synced {new Date(provider.lastSync).toLocaleTimeString()}</span>}
                <button onClick={() => handleDeleteProvider(provider.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Sessions */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Active Sessions
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-tertiary text-xs border-b" style={{ borderColor: 'var(--color-border)' }}>
                <th scope="col" className="pb-2 font-medium">User</th>
                <th scope="col" className="pb-2 font-medium">Provider</th>
                <th scope="col" className="pb-2 font-medium">IP</th>
                <th scope="col" className="pb-2 font-medium">Login</th>
                <th scope="col" className="pb-2 font-medium">Expires</th>
                <th scope="col" className="pb-2 font-medium">Status</th>
                <th scope="col" className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(session => (
                <tr key={session.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="py-3">
                    <div className="text-text-primary text-sm">{session.user}</div>
                    <div className="text-text-tertiary text-xs">{session.email}</div>
                  </td>
                  <td className="py-3 text-text-secondary text-xs">{session.provider}</td>
                  <td className="py-3 text-text-tertiary font-mono text-xs">{session.ip}</td>
                  <td className="py-3 text-text-tertiary text-xs">{new Date(session.loginAt).toLocaleTimeString()}</td>
                  <td className="py-3 text-text-tertiary text-xs">{new Date(session.expiresAt).toLocaleTimeString()}</td>
                  <td className="py-3">
                    <span className={`inline-block w-2 h-2 rounded-full ${session.active ? 'bg-green-400' : 'bg-gray-500'}`} />
                  </td>
                  <td className="py-3">
                    {session.active && (
                      <button onClick={() => handleRevokeSession(session.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Revoke</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
