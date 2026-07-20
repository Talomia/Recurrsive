/**
 * @module Dashboard Users Management Page with Invitations
 *
 * Admin-only page for managing platform users and team invites.
 * Users tab: CRUD operations on users.
 * Invitations tab: create/cancel invites, copy invite links.
 *
 * @packageDocumentation
 */

'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import {
  Users as UsersIcon,
  Plus,
  Trash2,
  Pencil,
  X,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  Mail,
  Copy,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';
import ErrorBanner from '@/components/error-banner';
import Header from '@/components/header';
import LoadingSkeleton from '@/components/loading-skeleton';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TABS = ['Users', 'Invitations'] as const;
type Tab = typeof TABS[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  displayName?: string;
  authMethod?: string;
  createdAt: string;
}

interface NewUserForm {
  username: string;
  email: string;
  password: string;
  role: string;
  displayName: string;
}

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

const EMPTY_USER_FORM: NewUserForm = { username: '', email: '', password: '', role: 'viewer', displayName: '' };
const EMPTY_INVITE_FORM: NewInviteForm = { email: '', role: 'viewer' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roleBadge(role: string) {
  const map: Record<string, { bg: string; text: string }> = {
    admin:   { bg: 'bg-purple-500/15', text: 'text-purple-400' },
    analyst: { bg: 'bg-blue-500/15',   text: 'text-blue-400' },
    viewer:  { bg: 'bg-green-500/15',  text: 'text-green-400' },
  };
  const cfg = map[role] ?? { bg: 'bg-white/10', text: 'text-text-secondary' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.text} border border-current/20`}>
      {role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
      {role}
    </span>
  );
}

function statusBadge(status: string) {
  const active = status === 'active';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
      active ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
    }`}>
      {active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
      {status}
    </span>
  );
}

function inviteStatusBadge(status: string) {
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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('Users');

  // --- Users state ---
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add user modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<NewUserForm>(EMPTY_USER_FORM);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit user modal
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // --- Invites state ---
  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesLoaded, setInvitesLoaded] = useState(false);
  const [invitesError, setInvitesError] = useState<string | null>(null);

  const [showCreateInvite, setShowCreateInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState<NewInviteForm>(EMPTY_INVITE_FORM);
  const [createInviteLoading, setCreateInviteLoading] = useState(false);
  const [createInviteError, setCreateInviteError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [cancelInviteTarget, setCancelInviteTarget] = useState<Invite | null>(null);
  const [cancelInviteLoading, setCancelInviteLoading] = useState(false);

  // Modal focus management
  const addFirstFieldRef = useRef<HTMLInputElement>(null);
  const editSelectRef = useRef<HTMLSelectElement>(null);
  const inviteFirstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAdd) { const t = setTimeout(() => addFirstFieldRef.current?.focus(), 0); return () => clearTimeout(t); }
  }, [showAdd]);
  useEffect(() => {
    if (editUser) { const t = setTimeout(() => editSelectRef.current?.focus(), 0); return () => clearTimeout(t); }
  }, [editUser]);
  useEffect(() => {
    if (showCreateInvite) { const t = setTimeout(() => inviteFirstFieldRef.current?.focus(), 0); return () => clearTimeout(t); }
  }, [showCreateInvite]);

  // Escape closes whichever modal is open.
  useEffect(() => {
    if (!showAdd && !editUser && !showCreateInvite) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (showAdd) { setShowAdd(false); setAddError(null); }
      if (editUser) setEditUser(null);
      if (showCreateInvite) { setShowCreateInvite(false); setCreateInviteError(null); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showAdd, editUser, showCreateInvite]);

  // ── Fetch users ──

  async function fetchUsers() {
    try {
      const data = await apiFetch<User[]>('/api/v1/users');
      setUsers(data ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    }
  }

  useEffect(() => {
    fetchUsers().finally(() => setLoading(false));
  }, []);

  // ── Fetch invites (lazy) ──

  async function fetchInvites() {
    try {
      setInvitesError(null);
      const data = await apiFetch('/api/v1/invites');
      setInvites(Array.isArray(data) ? data : (data as { data?: Invite[] }).data ?? []);
    } catch (err) {
      setInvitesError(err instanceof Error ? err.message : 'Failed to load invites');
    }
  }

  useEffect(() => {
    if (activeTab !== 'Invitations' || invitesLoaded) return;
    setInvitesLoading(true);
    fetchInvites().finally(() => { setInvitesLoading(false); setInvitesLoaded(true); });
  }, [activeTab, invitesLoaded]);

  // ── User CRUD ──

  async function handleAddUser(e: FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAddLoading(true);
    try {
      await apiFetch('/api/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          username: addForm.username.trim(),
          email: addForm.email.trim(),
          password: addForm.password,
          role: addForm.role,
          displayName: addForm.displayName.trim() || undefined,
        }),
      });
      const createdName = addForm.username.trim();
      setShowAdd(false);
      setAddForm(EMPTY_USER_FORM);
      await fetchUsers();
      toast(`User "${createdName}" created.`, 'success');
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to create user');
      toast('Failed to create user.', 'error');
    } finally {
      setAddLoading(false);
    }
  }

  async function handleEditSave() {
    if (!editUser) return;
    const name = editUser.username;
    setEditLoading(true);
    try {
      await apiFetch(`/api/v1/users/${editUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ role: editRole }),
      });
      setEditUser(null);
      await fetchUsers();
      toast(`Role updated for "${name}".`, 'success');
    } catch {
      setError('Failed to save user.');
      toast('Failed to update role.', 'error');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleToggleStatus(u: User) {
    const disabling = u.status === 'active';
    try {
      await apiFetch(`/api/v1/users/${u.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: disabling ? 'disabled' : 'active' }),
      });
      await fetchUsers();
      toast(`User "${u.username}" ${disabling ? 'disabled' : 'enabled'}.`, 'success');
    } catch {
      setError('Failed to toggle user status.');
      toast(`Failed to ${disabling ? 'disable' : 'enable'} user.`, 'error');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const name = deleteTarget.username;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/v1/users/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await fetchUsers();
      toast(`User "${name}" deleted.`, 'info');
    } catch {
      setError('Failed to delete user.');
      toast('Failed to delete user.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Invite CRUD ──

  async function handleCreateInvite(e: FormEvent) {
    e.preventDefault();
    setCreateInviteLoading(true);
    setCreateInviteError(null);
    try {
      await apiFetch('/api/v1/invites', {
        method: 'POST',
        body: JSON.stringify(inviteForm),
      });
      const invitedEmail = inviteForm.email;
      setShowCreateInvite(false);
      setInviteForm(EMPTY_INVITE_FORM);
      await fetchInvites();
      toast(`Invite sent to ${invitedEmail}.`, 'success');
    } catch (err) {
      setCreateInviteError(err instanceof Error ? err.message : 'Failed to create invite');
      toast('Failed to create invite.', 'error');
    } finally {
      setCreateInviteLoading(false);
    }
  }

  async function confirmCancelInvite() {
    if (!cancelInviteTarget) return;
    const { id, email } = cancelInviteTarget;
    setCancelInviteLoading(true);
    try {
      await apiFetch(`/api/v1/invites/${id}`, { method: 'DELETE' });
      await fetchInvites();
      toast(`Invite for ${email} cancelled.`, 'info');
      setCancelInviteTarget(null);
    } catch {
      setInvitesError('Failed to cancel invite.');
      toast('Failed to cancel invite.', 'error');
    } finally {
      setCancelInviteLoading(false);
    }
  }

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

  // ── Render ──

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Users" subtitle="Manage platform users, roles, and access" />
        <LoadingSkeleton variant="table" count={5} />
      </div>
    );
  }

  const pendingCount = invites.filter(i => i.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header
        title="Users"
        subtitle={`Manage platform users, roles, and access · ${users.length} ${users.length === 1 ? 'user' : 'users'}`}
      />

      {/* Action buttons */}
      <div className="flex justify-end -mt-2">
        {activeTab === 'Users' && (
          <button
            onClick={() => { setShowAdd(true); setAddError(null); setAddForm(EMPTY_USER_FORM); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))',
            }}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add User
          </button>
        )}
        {activeTab === 'Invitations' && (
          <button
            onClick={() => setShowCreateInvite(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))',
            }}
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Invite Member
          </button>
        )}
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-1 border-b border-white/10"
        role="tablist"
        aria-label="Users sections"
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? 'text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab}
            {tab === 'Invitations' && invitesLoaded && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'Users' && (
        <div role="tabpanel" aria-label="Users" className="space-y-6">
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            {users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="rounded-2xl bg-blue-500/10 p-4 mb-4">
                  <UsersIcon className="h-8 w-8 text-blue-400" />
                </div>
                <h3 className="text-sm font-medium text-text-primary mb-1">No users found</h3>
                <p className="text-xs text-text-tertiary max-w-xs">
                  Add your first user to get started with the platform.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary"
                        style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th className="px-5 py-3">Username</th>
                      <th className="px-5 py-3">Email</th>
                      <th className="px-5 py-3">Role</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Auth</th>
                      <th className="px-5 py-3">Created</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3">
                          <div>
                            <p className="font-medium text-text-primary">{u.username}</p>
                            {u.displayName && (
                              <p className="text-[11px] text-text-tertiary">{u.displayName}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-text-secondary">{u.email}</td>
                        <td className="px-5 py-3">{roleBadge(u.role)}</td>
                        <td className="px-5 py-3">{statusBadge(u.status)}</td>
                        <td className="px-5 py-3 text-text-tertiary text-xs">
                          {u.authMethod ?? 'local'}
                        </td>
                        <td className="px-5 py-3 text-text-tertiary text-xs">
                          {formatDate(u.createdAt)}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setEditUser(u); setEditRole(u.role); }}
                              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-text-tertiary hover:text-text-primary"
                              title="Edit role"
                              aria-label={`Edit role for ${u.username}`}
                            >
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-text-tertiary hover:text-amber-400"
                              title={u.status === 'active' ? 'Disable user' : 'Enable user'}
                              aria-label={u.status === 'active' ? `Disable ${u.username}` : `Enable ${u.username}`}
                            >
                              {u.status === 'active'
                                ? <UserX className="w-3.5 h-3.5" aria-hidden="true" />
                                : <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                              }
                            </button>
                            {u.id !== currentUser?.userId && (
                              <button
                                onClick={() => setDeleteTarget(u)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-text-tertiary hover:text-red-400"
                                title="Delete user"
                                aria-label={`Delete ${u.username}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === 'Invitations' && (
        <div role="tabpanel" aria-label="Invitations" className="space-y-6">
          {invitesError && <ErrorBanner message={invitesError} onDismiss={() => setInvitesError(null)} />}

          {invitesLoading ? (
            <LoadingSkeleton variant="table" count={4} />
          ) : invites.length === 0 ? (
            <div className="rounded-2xl p-12 text-center"
                 style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <Mail className="w-12 h-12 mx-auto text-text-tertiary mb-4" />
              <h3 className="text-lg font-medium text-text-primary mb-2">No invites yet</h3>
              <p className="text-text-secondary text-sm mb-4">Invite team members to collaborate on your platform.</p>
              <button
                onClick={() => setShowCreateInvite(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))' }}
              >
                <Plus className="w-4 h-4" /> Send First Invite
              </button>
            </div>
          ) : (
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
                      <td className="px-4 py-3">{inviteStatusBadge(inv.status)}</td>
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
                                onClick={() => setCancelInviteTarget(inv)}
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
          )}
        </div>
      )}

      {/* ── Add User Modal ──────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Add user">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)} aria-hidden="true" />
          <div
            className="relative w-full max-w-md rounded-2xl p-6"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-text-primary">Add User</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-white/10 text-text-tertiary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Username</label>
                <input
                  ref={addFirstFieldRef}
                  type="text"
                  value={addForm.username}
                  onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                  style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
                  placeholder="username"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                  style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Password</label>
                <input
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                  style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
                  placeholder="Min. 8 characters"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Display Name</label>
                <input
                  type="text"
                  value={addForm.displayName}
                  onChange={(e) => setAddForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                  style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Role</label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2"
                  style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
                >
                  <option value="viewer">Viewer</option>
                  <option value="analyst">Analyst</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {addError && (
                <div className="rounded-lg px-3 py-2 text-xs text-red-400"
                     style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {addError}
                </div>
              )}

              <button
                type="submit"
                disabled={addLoading}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 mt-2"
                style={{
                  background: addLoading ? 'var(--color-border)' : 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))',
                  opacity: addLoading ? 0.6 : 1,
                }}
              >
                {addLoading ? 'Creating…' : 'Create User'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Role Modal ──────────────────────────────────────────────── */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Edit user role">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditUser(null)} aria-hidden="true" />
          <div
            className="relative w-full max-w-sm rounded-2xl p-6"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-text-primary">Edit Role</h3>
              <button onClick={() => setEditUser(null)} className="p-1 rounded-lg hover:bg-white/10 text-text-tertiary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              Changing role for <span className="font-semibold text-text-primary">{editUser.username}</span>
            </p>
            <select
              ref={editSelectRef}
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm text-text-primary mb-4 focus:outline-none focus:ring-2"
              style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
            >
              <option value="viewer">Viewer</option>
              <option value="analyst">Analyst</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setEditUser(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editLoading || editRole === editUser.role}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-200"
                style={{
                  background: editLoading ? 'var(--color-border)' : 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))',
                  opacity: editLoading || editRole === editUser.role ? 0.6 : 1,
                }}
              >
                {editLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ──────────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete user"
        destructive
        loading={deleteLoading}
        confirmLabel="Delete"
        message={
          <>
            Are you sure you want to delete{' '}
            <span className="font-semibold text-text-primary">{deleteTarget?.username}</span>? This action
            cannot be undone.
          </>
        }
        onConfirm={handleDeleteConfirm}
        onCancel={() => { if (!deleteLoading) setDeleteTarget(null); }}
      />

      {/* ── Cancel Invite Confirmation ──────────────────────────────────── */}
      <ConfirmDialog
        open={cancelInviteTarget !== null}
        title="Cancel invite"
        destructive
        loading={cancelInviteLoading}
        confirmLabel="Cancel invite"
        cancelLabel="Keep invite"
        message={
          <>
            Cancel the pending invite for{' '}
            <span className="font-semibold text-text-primary">{cancelInviteTarget?.email}</span>? The invite
            link will stop working immediately.
          </>
        }
        onConfirm={confirmCancelInvite}
        onCancel={() => { if (!cancelInviteLoading) setCancelInviteTarget(null); }}
      />

      {/* ── Create Invite Modal ──────────────────────────────────────────── */}
      {showCreateInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Invite team member">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowCreateInvite(false); setCreateInviteError(null); }} aria-hidden="true" />
          <div className="relative w-full max-w-md rounded-2xl p-6"
               style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text-primary">Invite Team Member</h3>
              <button onClick={() => { setShowCreateInvite(false); setCreateInviteError(null); }}
                      className="p-1 rounded-lg hover:bg-white/10 text-text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Email Address</label>
                <input
                  ref={inviteFirstFieldRef}
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                  style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
                  placeholder="colleague@company.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2"
                  style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
                >
                  <option value="viewer">Viewer — read-only access</option>
                  <option value="analyst">Analyst — can run analysis</option>
                  <option value="admin">Admin — full access</option>
                </select>
              </div>

              {createInviteError && (
                <div className="rounded-lg px-4 py-2.5 text-sm"
                     style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  {createInviteError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateInvite(false); setCreateInviteError(null); }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-white/5 transition-colors"
                  style={{ border: '1px solid var(--color-border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createInviteLoading}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200"
                  style={{
                    background: createInviteLoading
                      ? 'var(--color-border)'
                      : 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))',
                  }}
                >
                  {createInviteLoading ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
