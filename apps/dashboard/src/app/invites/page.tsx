/**
 * @module Dashboard Invites Page
 *
 * Admin-only page for managing team invites.
 * Fetches invite list from GET /api/v1/invites and
 * supports creating and cancelling invites.
 *
 * @packageDocumentation
 */

'use client';

import { useState, useEffect, type FormEvent } from 'react';
import {
  Mail,
  Plus,
  Loader2,
  Trash2,
  X,
  Copy,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Invite {
  id: string;
  email: string;
  role: string;
  token: string;
  status: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
}

interface NewInviteForm {
  email: string;
  role: string;
}

const EMPTY_FORM: NewInviteForm = { email: '', role: 'viewer' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roleBadge(role: string) {
  const map: Record<string, { bg: string; text: string }> = {
    admin:   { bg: 'bg-purple-500/15', text: 'text-purple-400' },
    analyst: { bg: 'bg-blue-500/15',   text: 'text-blue-400' },
    viewer:  { bg: 'bg-green-500/15',  text: 'text-green-400' },
  };
  const cfg = map[role] ?? { bg: 'bg-white/10', text: 'text-text-secondary' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {role}
    </span>
  );
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
    pending:  { bg: 'bg-amber-500/15',  text: 'text-amber-400',  icon: Clock },
    accepted: { bg: 'bg-green-500/15',  text: 'text-green-400',  icon: CheckCircle2 },
    expired:  { bg: 'bg-red-500/15',    text: 'text-red-400',    icon: XCircle },
  };
  const cfg = map[status] ?? { bg: 'bg-white/10', text: 'text-text-secondary', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function InvitesPage() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewInviteForm>(EMPTY_FORM);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Copied link state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Fetch invites ────────────────────────────────────────────────────────

  async function fetchInvites() {
    try {
      setError(null);
      const data = await apiFetch('/api/v1/invites');
      setInvites(Array.isArray(data) ? data : (data as { data?: Invite[] }).data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchInvites(); }, []);

  // ── Create invite ────────────────────────────────────────────────────────

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    try {
      await apiFetch('/api/v1/invites', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await fetchInvites();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setCreateLoading(false);
    }
  }

  // ── Cancel invite ────────────────────────────────────────────────────────

  async function handleCancel(id: string) {
    try {
      await apiFetch(`/api/v1/invites/${id}`, { method: 'DELETE' });
      await fetchInvites();
    } catch {
      setError('Failed to cancel invite.');
    }
  }

  // ── Copy invite link ─────────────────────────────────────────────────────

  async function copyInviteLink(invite: Invite) {
    const link = `${window.location.origin}/invite/${invite.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  }

  // ── Guard: admin only ────────────────────────────────────────────────────

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Mail className="w-12 h-12 mx-auto text-text-tertiary mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">Access Denied</h2>
          <p className="text-text-secondary text-sm">Only admins can manage team invites.</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const pendingCount = invites.filter(i => i.status === 'pending').length;

  return (
    <div className="space-y-6 px-4 pb-6 pt-20 sm:px-6 lg:p-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))' }}>
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">Team Invites</h1>
            <p className="text-sm text-text-secondary">
              {invites.length} total · {pendingCount} pending
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-200"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))' }}
        >
          <Plus className="w-4 h-4" /> Invite Member
        </button>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm"
             style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          {error}
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
        </div>
      ) : invites.length === 0 ? (
        <div className="rounded-2xl p-12 text-center"
             style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <Mail className="w-12 h-12 mx-auto text-text-tertiary mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-2">No invites yet</h3>
          <p className="text-text-secondary text-sm mb-4">Invite team members to collaborate on your platform.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))' }}
          >
            <Plus className="w-4 h-4" /> Send First Invite
          </button>
        </div>
      ) : (
        /* ── Invites Table ────────────────────────────────────────────────── */
        <div className="rounded-2xl overflow-hidden"
             style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">Email</th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">Role</th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">Status</th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">Invited</th>
                <th className="text-left px-4 py-3 text-text-secondary font-medium">Expires</th>
                <th className="text-right px-4 py-3 text-text-secondary font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id}
                    className="border-b last:border-b-0 hover:bg-white/[0.02] transition-colors"
                    style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-3 text-text-primary font-medium">{inv.email}</td>
                  <td className="px-4 py-3">{roleBadge(inv.role)}</td>
                  <td className="px-4 py-3">{statusBadge(inv.status)}</td>
                  <td className="px-4 py-3 text-text-secondary">{fmtDate(inv.createdAt)}</td>
                  <td className="px-4 py-3 text-text-secondary">{fmtDate(inv.expiresAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {inv.status === 'pending' && (
                        <>
                          <button
                            onClick={() => copyInviteLink(inv)}
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-text-secondary hover:text-text-primary"
                            title="Copy invite link"
                          >
                            {copiedId === inv.id ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleCancel(inv.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-text-secondary hover:text-red-400"
                            title="Cancel invite"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create Invite Modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl p-6"
               style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text-primary">Invite Team Member</h3>
              <button onClick={() => { setShowCreate(false); setCreateError(null); }}
                      className="p-1 rounded-lg hover:bg-white/10 text-text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                  style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
                  placeholder="colleague@company.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2"
                  style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
                >
                  <option value="viewer">Viewer — read-only access</option>
                  <option value="analyst">Analyst — can run analysis</option>
                  <option value="admin">Admin — full access</option>
                </select>
              </div>

              {createError && (
                <div className="rounded-lg px-4 py-2.5 text-sm"
                     style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  {createError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setCreateError(null); }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-white/5 transition-colors"
                  style={{ border: '1px solid var(--color-border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200"
                  style={{
                    background: createLoading
                      ? 'var(--color-border)'
                      : 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))',
                  }}
                >
                  {createLoading ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
