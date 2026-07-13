/**
 * @module Dashboard Setup Page
 *
 * First-run setup wizard for creating the initial admin account.
 * Checks GET /api/v1/setup/status to see if setup is needed;
 * if not, redirects to login.
 *
 * @packageDocumentation
 */

'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';
import { Loader2 } from 'lucide-react';

interface SetupStatus {
  setupRequired: boolean;
}

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form fields
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Check if setup is actually needed
  useEffect(() => {
    let cancelled = false;
    async function checkSetup() {
      try {
        const status = await apiFetch<SetupStatus>('/api/v1/setup/status');
        if (!cancelled && !status?.setupRequired) {
          router.replace('/login');
          return;
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to check setup status');
      }
      if (!cancelled) setChecking(false);
    }
    checkSetup();
    return () => { cancelled = true; };
  }, [router]);

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (!username.trim()) errors.username = 'Username is required';
    else if (username.length < 3) errors.username = 'Username must be at least 3 characters';

    if (!email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Invalid email address';

    if (!password) errors.password = 'Password is required';
    else if (password.length < 12) errors.password = 'Password must be at least 12 characters';

    if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setSubmitting(true);
    try {
      const body = await apiFetch<{ data?: { user?: unknown } }>('/api/v1/setup', {
        method: 'POST',
        unwrap: false,
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
          password,
          displayName: displayName.trim() || undefined,
        }),
      });

      // The dashboard proxy stores the returned JWT in an HttpOnly cookie.
      window.location.assign(body.data?.user ? '/' : '/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setSubmitting(false);
    }
  }

  // Loading state while checking setup status
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: 'linear-gradient(135deg, var(--color-base) 0%, #0d1525 50%, #111827 100%)' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-accent)' }} />
          <span className="text-sm text-text-secondary">Checking setup status…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
         style={{ background: 'linear-gradient(135deg, var(--color-base) 0%, #0d1525 50%, #111827 100%)' }}>
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))' }}>
              <span className="text-xl">⟁</span>
            </div>
            <h1 className="text-2xl font-bold text-text-primary">Recurrsive</h1>
          </div>
          <p className="text-text-secondary text-sm">
            Welcome to Recurrsive
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-3 mb-6 px-1">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                 style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))' }}>
              1
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-primary truncate">Create Admin Account</p>
              <p className="text-[10px] text-text-tertiary">Set up your first administrator</p>
            </div>
          </div>
          <div className="w-8 h-px" style={{ background: 'var(--color-border)' }} />
          <div className="flex items-center gap-2 opacity-40">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-text-tertiary shrink-0"
                 style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              2
            </div>
            <span className="text-xs text-text-tertiary hidden sm:block">Configure</span>
          </div>
        </div>

        {/* Setup Card */}
        <div className="rounded-2xl p-8"
             style={{
               background: 'var(--color-surface)',
               border: '1px solid var(--color-border)',
               boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
             }}>
          <h2 className="text-lg font-semibold text-text-primary mb-1">Create your admin account</h2>
          <p className="text-sm text-text-tertiary mb-6">
            This will be the first administrator for your Recurrsive installation.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label htmlFor="setup-username" className="block text-sm font-medium text-text-secondary mb-1.5">
                Username <span className="text-red-400">*</span>
              </label>
              <input
                id="setup-username"
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setFieldErrors((p) => ({ ...p, username: '' })); }}
                className="w-full px-4 py-2.5 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--color-base)',
                  border: fieldErrors.username ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--color-border)',
                }}
                placeholder="admin"
                required
                autoComplete="username"
              />
              {fieldErrors.username && (
                <p className="text-xs text-red-400 mt-1">{fieldErrors.username}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="setup-email" className="block text-sm font-medium text-text-secondary mb-1.5">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                id="setup-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: '' })); }}
                className="w-full px-4 py-2.5 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--color-base)',
                  border: fieldErrors.email ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--color-border)',
                }}
                placeholder="admin@example.com"
                required
                autoComplete="email"
              />
              {fieldErrors.email && (
                <p className="text-xs text-red-400 mt-1">{fieldErrors.email}</p>
              )}
            </div>

            {/* Display Name (optional) */}
            <div>
              <label htmlFor="setup-display" className="block text-sm font-medium text-text-secondary mb-1.5">
                Display Name
              </label>
              <input
                id="setup-display"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--color-base)',
                  border: '1px solid var(--color-border)',
                }}
                placeholder="Admin User"
                autoComplete="name"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="setup-password" className="block text-sm font-medium text-text-secondary mb-1.5">
                Password <span className="text-red-400">*</span>
              </label>
              <input
                id="setup-password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: '', confirmPassword: '' })); }}
                className="w-full px-4 py-2.5 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--color-base)',
                  border: fieldErrors.password ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--color-border)',
                }}
                placeholder="Min. 12 characters"
                required
                autoComplete="new-password"
              />
              {fieldErrors.password && (
                <p className="text-xs text-red-400 mt-1">{fieldErrors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="setup-confirm" className="block text-sm font-medium text-text-secondary mb-1.5">
                Confirm Password <span className="text-red-400">*</span>
              </label>
              <input
                id="setup-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((p) => ({ ...p, confirmPassword: '' })); }}
                className="w-full px-4 py-2.5 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--color-base)',
                  border: fieldErrors.confirmPassword ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--color-border)',
                }}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
              />
              {fieldErrors.confirmPassword && (
                <p className="text-xs text-red-400 mt-1">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            {/* Server error */}
            {error && (
              <div className="rounded-lg px-4 py-2.5 text-sm"
                   style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200"
              style={{
                background: submitting
                  ? 'var(--color-border)'
                  : 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Creating account…' : 'Create Admin Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-text-tertiary mt-6">
          Recurrsive Engineering Intelligence Platform
        </p>
      </div>
    </div>
  );
}
