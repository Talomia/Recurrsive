'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Download, KeyRound, Loader2, Pencil, Shield, Trash2, Users } from 'lucide-react';
import Header from '@/components/header';
import {
  createSsoProvider,
  deleteSsoProvider,
  getSSOMetadataUrl,
  getSSOProvider,
  getSSOProviders,
  getSSOSessions,
  revokeSsoSession,
  type SSOProvider,
  type SSOProviderConfig,
  type SSOSession,
} from '@/lib/api';

type ProviderType = SSOProviderConfig['provider'];

interface FormState {
  id: string;
  provider: ProviderType;
  displayName: string;
  idpEntityId: string;
  spEntityId: string;
  ssoUrl: string;
  certificate: string;
  signatureMode: SSOProviderConfig['signatureMode'];
  allowedDomains: string;
  autoProvision: boolean;
  defaultRole: SSOProviderConfig['defaultRole'];
  groupRoleMapping: string;
}

const EMPTY_FORM: FormState = {
  id: '', provider: 'custom', displayName: '', idpEntityId: '', spEntityId: '', ssoUrl: '', certificate: '',
  signatureMode: 'both', allowedDomains: '', autoProvision: true, defaultRole: 'viewer', groupRoleMapping: '{}',
};

export default function SSOPage() {
  const [providers, setProviders] = useState<SSOProvider[]>([]);
  const [sessions, setSessions] = useState<SSOSession[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [nextProviders, nextSessions] = await Promise.all([getSSOProviders(), getSSOSessions()]);
    setProviders(nextProviders);
    setSessions(nextSessions);
  }

  useEffect(() => {
    refresh().catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load SSO configuration.')).finally(() => setLoading(false));
  }, []);

  async function editProvider(provider: SSOProvider) {
    setError(null);
    try {
      const config = await getSSOProvider(provider.id);
      setForm({
        id: provider.id,
        provider: config.provider,
        displayName: config.displayName,
        idpEntityId: config.idpEntityId,
        spEntityId: config.spEntityId,
        ssoUrl: config.ssoUrl,
        certificate: config.certificate,
        signatureMode: config.signatureMode,
        allowedDomains: config.allowedDomains.join(', '),
        autoProvision: config.autoProvision,
        defaultRole: config.defaultRole,
        groupRoleMapping: JSON.stringify(config.groupRoleMapping ?? {}, null, 2),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load provider.');
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const groupRoleMapping = JSON.parse(form.groupRoleMapping || '{}') as Record<string, 'admin' | 'analyst' | 'viewer'>;
      await createSsoProvider(form.id, {
        provider: form.provider,
        displayName: form.displayName,
        idpEntityId: form.idpEntityId,
        spEntityId: form.spEntityId,
        ssoUrl: form.ssoUrl,
        certificate: form.certificate,
        signatureMode: form.signatureMode,
        allowedDomains: form.allowedDomains.split(',').map((domain) => domain.trim()).filter(Boolean),
        autoProvision: form.autoProvision,
        defaultRole: form.defaultRole,
        groupRoleMapping,
      });
      setForm(null);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save provider. Check the group mapping JSON.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center" role="status"><Loader2 className="h-8 w-8 animate-spin text-accent-blue" /></div>;

  return (
    <div className="space-y-6 px-4 pb-6 sm:px-6 lg:p-6">
      <Header title="Single sign-on" subtitle="Signed SAML 2.0 identity providers and active sessions" />
      <div className="flex justify-end"><button type="button" onClick={() => setForm({ ...EMPTY_FORM })} className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white">Add SAML provider</button></div>
      {error && <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}

      {form && (
        <form onSubmit={save} className="glass-card space-y-5 rounded-2xl p-5">
          <div><h2 className="font-semibold text-text-primary">{providers.some((provider) => provider.id === form.id) ? 'Edit' : 'Configure'} SAML provider</h2><p className="mt-1 text-xs text-text-muted">Responses and assertions are signature-validated and matched to one-time authentication requests.</p></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-text-secondary">Provider ID<input required disabled={providers.some((provider) => provider.id === form.id)} value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-text-primary disabled:opacity-60" placeholder="company-okta" /></label>
            <label className="text-sm text-text-secondary">Provider type<select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value as ProviderType })} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-text-primary"><option value="okta">Okta</option><option value="auth0">Auth0</option><option value="azure-ad">Microsoft Entra ID</option><option value="google-workspace">Google Workspace</option><option value="custom">Custom SAML</option></select></label>
            <label className="text-sm text-text-secondary">Display name<input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-text-primary" /></label>
            <label className="text-sm text-text-secondary">Signature requirement<select value={form.signatureMode} onChange={(event) => setForm({ ...form, signatureMode: event.target.value as FormState['signatureMode'] })} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-text-primary"><option value="both">Signed response and assertion</option><option value="response">Signed response</option><option value="assertion">Signed assertion</option><option value="either">Either signed element</option></select></label>
            <label className="text-sm text-text-secondary">IdP entity ID<input required value={form.idpEntityId} onChange={(event) => setForm({ ...form, idpEntityId: event.target.value })} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-text-primary" /></label>
            <label className="text-sm text-text-secondary">SP entity ID / audience<input required value={form.spEntityId} onChange={(event) => setForm({ ...form, spEntityId: event.target.value })} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-text-primary" /></label>
            <label className="text-sm text-text-secondary md:col-span-2">IdP SSO URL<input required type="url" value={form.ssoUrl} onChange={(event) => setForm({ ...form, ssoUrl: event.target.value })} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-text-primary" /></label>
            <label className="text-sm text-text-secondary md:col-span-2">IdP signing certificate<textarea required rows={6} value={form.certificate} onChange={(event) => setForm({ ...form, certificate: event.target.value })} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 font-mono text-xs text-text-primary" placeholder="-----BEGIN CERTIFICATE-----" /></label>
            <label className="text-sm text-text-secondary">Allowed email domains<input value={form.allowedDomains} onChange={(event) => setForm({ ...form, allowedDomains: event.target.value })} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-text-primary" placeholder="example.com, subsidiary.com" /></label>
            <label className="text-sm text-text-secondary">Default provisioned role<select value={form.defaultRole} onChange={(event) => setForm({ ...form, defaultRole: event.target.value as FormState['defaultRole'] })} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-text-primary"><option value="viewer">Viewer</option><option value="analyst">Analyst</option><option value="admin">Admin</option></select></label>
            <label className="text-sm text-text-secondary md:col-span-2">Group-to-role mapping (JSON)<textarea rows={4} value={form.groupRoleMapping} onChange={(event) => setForm({ ...form, groupRoleMapping: event.target.value })} className="mt-1.5 w-full rounded-lg border border-white/10 bg-base px-3 py-2 font-mono text-xs text-text-primary" /></label>
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={form.autoProvision} onChange={(event) => setForm({ ...form, autoProvision: event.target.checked })} />Provision new users after the first valid SAML login</label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setForm(null)} className="px-4 py-2 text-sm text-text-secondary">Cancel</button><button disabled={saving} className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save provider'}</button></div>
        </form>
      )}

      <section className="glass-card rounded-2xl p-5" aria-labelledby="providers-title">
        <h2 id="providers-title" className="mb-4 flex items-center gap-2 font-semibold"><Shield className="h-4 w-4 text-accent-blue" />Identity providers</h2>
        {providers.length === 0 ? <p className="text-sm text-text-secondary">No identity providers configured.</p> : <div className="space-y-3">{providers.map((provider) => (
          <article key={provider.id} className="flex flex-col justify-between gap-4 rounded-xl border border-white/5 bg-base p-4 sm:flex-row sm:items-center">
            <div><div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-blue-400" /><h3 className="font-medium text-text-primary">{provider.displayName}</h3><span className="rounded bg-green-500/10 px-2 py-0.5 text-xs text-green-400">SAML</span></div><p className="mt-1 text-xs text-text-muted">{provider.idpEntityId}</p><p className="text-xs text-text-muted">Default role: {provider.defaultRole} · JIT {provider.autoProvision ? 'enabled' : 'disabled'}</p></div>
            <div className="flex gap-2"><a href={getSSOMetadataUrl(provider.id)} className="rounded-lg bg-white/5 p-2 text-text-secondary" aria-label={`Download ${provider.displayName} metadata`}><Download className="h-4 w-4" /></a><button type="button" onClick={() => void editProvider(provider)} className="rounded-lg bg-white/5 p-2 text-text-secondary" aria-label={`Edit ${provider.displayName}`}><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => { if (window.confirm(`Delete SSO provider “${provider.displayName}”?`)) void deleteSsoProvider(provider.id).then(refresh).catch((reason) => setError(reason instanceof Error ? reason.message : 'Delete failed.')); }} className="rounded-lg bg-white/5 p-2 text-red-400" aria-label={`Delete ${provider.displayName}`}><Trash2 className="h-4 w-4" /></button></div>
          </article>
        ))}</div>}
      </section>

      <section className="glass-card rounded-2xl p-5" aria-labelledby="sessions-title">
        <h2 id="sessions-title" className="mb-4 flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-accent-blue" />Active SSO sessions</h2>
        {sessions.length === 0 ? <p className="text-sm text-text-secondary">No active SSO sessions.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-white/10 text-left text-xs text-text-muted"><th className="pb-2">Account</th><th className="pb-2">Provider</th><th className="pb-2">Created</th><th className="pb-2">Expires</th><th className="pb-2"><span className="sr-only">Actions</span></th></tr></thead><tbody>{sessions.map((session) => <tr key={session.sessionId} className="border-b border-white/5"><td className="py-3 text-text-primary">{session.email}</td><td className="py-3 text-text-secondary">{session.provider}</td><td className="py-3 text-xs text-text-muted">{new Date(session.createdAt).toLocaleString()}</td><td className="py-3 text-xs text-text-muted">{new Date(session.expiresAt).toLocaleString()}</td><td className="py-3 text-right"><button type="button" onClick={() => void revokeSsoSession(session.sessionId).then(refresh).catch((reason) => setError(reason instanceof Error ? reason.message : 'Revoke failed.'))} className="text-xs text-red-400">Revoke</button></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
