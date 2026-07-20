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

import { useState, useEffect, useRef, type FormEvent } from 'react';
import {
  Mail,
  Plus,
  Trash2,
  X,
  Copy,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import Header from '@/components/header';
import LoadingSkeleton from '@/components/loading-skeleton';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/format';

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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function InvitesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewInviteForm>(EMPTY_FORM);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Cancel confirmation
  const [cancelTarget, setCancelTarget] = useState<Invite | null>(null);
  const [cancelling, setCancelling] = useState(false);

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

  // Move focus into the create modal when it opens.
  useEffect(() => {
    if (showCreate) {
      const t = setTimeout(() => emailInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [showCreate]);

  // Escape closes the create modal.
  useEffect(() => {
    if (!showCreate) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setShowCreate(false); setCreateError(null); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showCreate]);

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
      const invitedEmail = form.email;
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await fetchInvites();
      toast(`Invite sent to ${invitedEmail}.`, 'success');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create invite');
      toast('Failed to create invite.', 'error');
    } finally {
      setCreateLoading(false);
    }
  }

  // ── Cancel invite ────────────────────────────────────────────────────────

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await apiFetch(`/api/v1/invites/${cancelTarget.id}`, { method: 'DELETE' });
      await fetchInvites();
      toast(`Invite for ${cancelTarget.email} cancelled.`, 'info');
      setCancelTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel invite.');
      toast('Failed to cancel invite.', 'error');
    } finally {
      setCancelling(false);
    }
  }

  // ── Copy invite link ─────────────────────────────────────────────────────

  async function copyInviteLink(invite: Invite) {
    const link = `${window.location.origin}/invite/${invite.token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast('Invite link copied to clipboard.', 'success');
    } catch {
      toast('Could not copy link. Copy it manually.', 'error');
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
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Header
        title="Team Invites"
        subtitle={`${invites.length} total · ${pendingCount} pending`}
      />
      <div className="flex items-center justify-end">
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
        <LoadingSkeleton variant="table" count={4} />
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
          <div className="overflow-x-auto">
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
                  <td className="px-4 py-3 text-text-secondary">{formatDate(inv.createdAt)}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatDate(inv.expiresAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {inv.status === 'pending' && (
                        <>
                          <button
                            onClick={() => copyInviteLink(inv)}
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-text-secondary hover:text-text-primary"
                            title="Copy invite link"
                            aria-label={`Copy invite link for ${inv.email}`}
                          >
                            {copiedId === inv.id ? <CheckCircle2 className="w-4 h-4 text-green-400" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                          </button>
                          <button
                            onClick={() => setCancelTarget(inv)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-text-secondary hover:text-red-400"
                            title="Cancel invite"
                            aria-label={`Cancel invite for ${inv.email}`}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
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
        </div>
      )}

      {/* ── Create Invite Modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Invite team member">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowCreate(false); setCreateError(null); }} aria-hidden="true" />
          <div className="relative w-full max-w-md rounded-2xl p-6"
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
                  ref={emailInputRef}
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

      {/* ── Cancel Invite Confirmation ──────────────────────────────────────── */}
      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel invite"
        destructive
        loading={cancelling}
        confirmLabel="Cancel invite"
        cancelLabel="Keep invite"
        message={
          <>
            Cancel the pending invite for{' '}
            <span className="font-semibold text-text-primary">{cancelTarget?.email}</span>? The invite link
            will stop working immediately.
          </>
        }
        onConfirm={confirmCancel}
        onCancel={() => { if (!cancelling) setCancelTarget(null); }}
      />
    </div>
  );
}
