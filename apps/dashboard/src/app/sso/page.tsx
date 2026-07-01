'use client';

/**
 * SSO Configuration page.
 *
 * Provider management, active sessions, and configuration form.
 */

import { useState, useEffect } from 'react';
import { KeyRound, Users, Shield, Globe, LogIn } from 'lucide-react';

interface SSOProvider {
  id: string;
  name: string;
  type: 'okta' | 'auth0' | 'azure_ad' | 'google';
  status: 'configured' | 'pending' | 'error';
  domain: string;
  protocol: 'SAML' | 'OIDC';
  usersCount: number;
  lastSync: string;
}

interface SSOSession {
  id: string;
  user: string;
  email: string;
  provider: string;
  ip: string;
  loginAt: string;
  expiresAt: string;
  active: boolean;
}

const demoProviders: SSOProvider[] = [
  { id: 'pr1', name: 'Okta Production', type: 'okta', status: 'configured', domain: 'recurrsive.okta.com', protocol: 'SAML', usersCount: 142, lastSync: '2026-07-01T18:00:00Z' },
  { id: 'pr2', name: 'Auth0 Staging', type: 'auth0', status: 'configured', domain: 'recurrsive-staging.auth0.com', protocol: 'OIDC', usersCount: 38, lastSync: '2026-07-01T17:30:00Z' },
  { id: 'pr3', name: 'Azure AD', type: 'azure_ad', status: 'pending', domain: 'recurrsive.onmicrosoft.com', protocol: 'SAML', usersCount: 0, lastSync: '' },
  { id: 'pr4', name: 'Google Workspace', type: 'google', status: 'configured', domain: 'recurrsive.dev', protocol: 'OIDC', usersCount: 89, lastSync: '2026-07-01T16:45:00Z' },
];

const demoSessions: SSOSession[] = [
  { id: 'se1', user: 'Alice Chen', email: 'alice@recurrsive.dev', provider: 'Okta Production', ip: '192.168.1.42', loginAt: '2026-07-01T08:12:00Z', expiresAt: '2026-07-01T20:12:00Z', active: true },
  { id: 'se2', user: 'Bob Martinez', email: 'bob@recurrsive.dev', provider: 'Google Workspace', ip: '10.0.0.15', loginAt: '2026-07-01T09:30:00Z', expiresAt: '2026-07-01T21:30:00Z', active: true },
  { id: 'se3', user: 'Carol Liu', email: 'carol@recurrsive.dev', provider: 'Okta Production', ip: '172.16.0.8', loginAt: '2026-07-01T07:00:00Z', expiresAt: '2026-07-01T19:00:00Z', active: false },
  { id: 'se4', user: 'Dan Okafor', email: 'dan@recurrsive.dev', provider: 'Auth0 Staging', ip: '192.168.2.100', loginAt: '2026-07-01T10:45:00Z', expiresAt: '2026-07-01T22:45:00Z', active: true },
  { id: 'se5', user: 'Eve Nakamura', email: 'eve@recurrsive.dev', provider: 'Google Workspace', ip: '10.0.1.22', loginAt: '2026-07-01T11:00:00Z', expiresAt: '2026-07-01T23:00:00Z', active: true },
];

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

  useEffect(() => {
    setTimeout(() => {
      setProviders(demoProviders);
      setSessions(demoSessions);
      setLoading(false);
    }, 300);
  }, []);

  const revokeSession = (id: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, active: false } : s));
  };

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
            <KeyRound className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
            SSO Configuration
          </h1>
          <p className="text-sm text-text-secondary mt-1">{providers.filter(p => p.status === 'configured').length} active providers · {sessions.filter(s => s.active).length} active sessions</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ background: 'var(--color-accent)' }}>
          <LogIn className="w-4 h-4" /> Add Provider
        </button>
      </div>

      {/* Add Provider Form */}
      {showAdd && (
        <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-base font-semibold text-text-primary mb-3">Configure New SSO Provider</h3>
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="Provider Name" value={newName} onChange={e => setNewName(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            <input placeholder="Domain" value={newDomain} onChange={e => setNewDomain(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            <select value={newType} onChange={e => setNewType(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>
              <option value="okta">Okta</option>
              <option value="auth0">Auth0</option>
              <option value="azure_ad">Azure AD</option>
              <option value="google">Google Workspace</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg text-sm text-text-secondary">Cancel</button>
            <button disabled={!newName || !newDomain} className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ background: newName && newDomain ? 'var(--color-accent)' : 'var(--color-border)', opacity: newName && newDomain ? 1 : 0.5 }}>
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* SSO Providers */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Identity Providers
        </h3>
        <div className="space-y-3">
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
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Sessions */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h3 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: 'var(--color-accent)' }} /> Active Sessions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-tertiary text-xs border-b" style={{ borderColor: 'var(--color-border)' }}>
                <th className="pb-2 font-medium">User</th>
                <th className="pb-2 font-medium">Provider</th>
                <th className="pb-2 font-medium">IP</th>
                <th className="pb-2 font-medium">Login</th>
                <th className="pb-2 font-medium">Expires</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
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
                      <button onClick={() => revokeSession(session.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Revoke</button>
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
