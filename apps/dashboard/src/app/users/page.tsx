/**
 * @module Dashboard Users Management Page
 *
 * Admin-only page for managing platform users.
 * Fetches user list from GET /api/v1/users and
 * supports CRUD operations.
 *
 * @packageDocumentation
 */

'use client';

import { useState, useEffect, type FormEvent } from 'react';
import {
  Users as UsersIcon,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  X,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth-context';

// ─── Types ───────────────────────────────────────────────────────────────────

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

const EMPTY_FORM: NewUserForm = { username: '', email: '', password: '', role: 'viewer', displayName: '' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add user modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<NewUserForm>(EMPTY_FORM);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit user modal
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Fetch users ────────────────────────────────────────────────────────

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

  // ── Add user ───────────────────────────────────────────────────────────

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
      setShowAdd(false);
      setAddForm(EMPTY_FORM);
      await fetchUsers();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to create user');
    } finally {
      setAddLoading(false);
    }
  }

  // ── Edit user role ─────────────────────────────────────────────────────

  async function handleEditSave() {
    if (!editUser) return;
    setEditLoading(true);
    try {
      await apiFetch(`/api/v1/users/${editUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ role: editRole }),
      });
      setEditUser(null);
      await fetchUsers();
    } catch {
      setError('Failed to save user. Please try again.');
    } finally {
      setEditLoading(false);
    }
  }

  // ── Toggle status ──────────────────────────────────────────────────────

  async function handleToggleStatus(u: User) {
    try {
      await apiFetch(`/api/v1/users/${u.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: u.status === 'active' ? 'disabled' : 'active' }),
      });
      await fetchUsers();
    } catch {
      setError('Failed to toggle user status. Please try again.');
    }
  }

  // ── Delete user ────────────────────────────────────────────────────────

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/v1/users/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await fetchUsers();
    } catch {
      setError('Failed to delete user. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <UsersIcon className="w-6 h-6" style={{ color: 'var(--color-accent)' }} />
            Users
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage platform users, roles, and access.
            <span className="ml-2 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-text-tertiary font-medium">
              {users.length} {users.length === 1 ? 'user' : 'users'}
            </span>
          </p>
        </div>

        <button
          onClick={() => { setShowAdd(true); setAddError(null); setAddForm(EMPTY_FORM); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))',
          }}
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3 text-sm text-red-400"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-3 hover:opacity-80">✕</button>
        </div>
      )}

      {/* Users Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-2xl bg-blue-500/10 p-4 mb-4">
              <UsersIcon className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-sm font-medium text-text-primary mb-1">No Users Found</h3>
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
                        {/* Edit role */}
                        <button
                          onClick={() => { setEditUser(u); setEditRole(u.role); }}
                          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-text-tertiary hover:text-text-primary"
                          title="Edit role"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {/* Toggle status */}
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-text-tertiary hover:text-amber-400"
                          title={u.status === 'active' ? 'Disable user' : 'Enable user'}
                        >
                          {u.status === 'active'
                            ? <UserX className="w-3.5 h-3.5" />
                            : <UserCheck className="w-3.5 h-3.5" />
                          }
                        </button>
                        {/* Delete */}
                        {u.id !== currentUser?.userId && (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-text-tertiary hover:text-red-400"
                            title="Delete user"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* ── Add User Modal ────────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)} />
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

      {/* ── Edit Role Modal ───────────────────────────────────────────────── */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditUser(null)} />
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

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div
            className="relative w-full max-w-sm rounded-2xl p-6"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-red-400">Delete User</h3>
              <button onClick={() => setDeleteTarget(null)} className="p-1 rounded-lg hover:bg-white/10 text-text-tertiary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-text-secondary mb-5">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-text-primary">{deleteTarget.username}</span>?
              This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-all duration-200"
                style={{
                  background: deleteLoading ? 'var(--color-border)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                  opacity: deleteLoading ? 0.6 : 1,
                }}
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
