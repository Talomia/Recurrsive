/**
 * @module Dashboard Invite Acceptance Page
 *
 * Public page where invited users set their username and password
 * to accept a team invitation.
 *
 * @packageDocumentation
 */

'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch, ApiError } from '@/lib/api/client';

interface InviteInfo {
  email: string;
  role: string;
  expiresAt: string;
}

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { login } = useAuth();
  const token = params.token as string;

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Validate the invite token ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function validate() {
      try {
        const data = await apiFetch<InviteInfo>(`/api/v1/invites/${encodeURIComponent(token)}/validate`);
        if (!cancelled) setInvite(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? 'This invite link is invalid or has expired.' : 'Failed to validate invite link.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    validate();
    return () => { cancelled = true; };
  }, [token]);

  // ── Accept the invite ──────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setSubmitError('Password must be at least 6 characters');
      return;
    }
    if (username.length < 3) {
      setSubmitError('Username must be at least 3 characters');
      return;
    }

    setSubmitting(true);
    try {
      const body = await apiFetch<{ data?: { token?: string }; token?: string }>(`/api/v1/invites/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        unwrap: false,
        body: JSON.stringify({ username, password, displayName: displayName || username }),
      });

      const newToken = body.data?.token ?? body.token;

      if (newToken) {
        // Store token and redirect
        localStorage.setItem('recurrsive_token', newToken);
        document.cookie = `recurrsive_token=${newToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''}`;
        router.push('/');
      } else {
        // Fallback: redirect to login
        router.push('/login');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
         style={{ background: 'linear-gradient(135deg, var(--color-base) 0%, #0d1525 50%, #111827 100%)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))' }}>
              <span className="text-xl">⟁</span>
            </div>
            <h1 className="text-2xl font-bold text-text-primary">Recurrsive</h1>
          </div>
          <p className="text-text-secondary text-sm">
            You&apos;ve been invited to join the team
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8"
             style={{
               background: 'var(--color-surface)',
               border: '1px solid var(--color-border)',
               boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
             }}>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                   style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
            </div>
          ) : error ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
                   style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                <span className="text-2xl">✕</span>
              </div>
              <h2 className="text-lg font-semibold text-text-primary mb-2">Invalid Invite</h2>
              <p className="text-text-secondary text-sm mb-4">{error}</p>
              <button
                onClick={() => router.push('/login')}
                className="text-sm font-medium transition-colors"
                style={{ color: 'var(--color-accent)' }}
              >
                Go to Login →
              </button>
            </div>
          ) : invite ? (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-text-primary mb-2">Create Your Account</h2>
                <p className="text-text-secondary text-sm">
                  You&apos;re joining as <span className="font-medium text-text-primary">{invite.email}</span> with
                  the <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/15 text-purple-400 ml-1">{invite.role}</span> role
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                    style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
                    placeholder="Choose a username"
                    required
                    minLength={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                    style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
                    placeholder="Your display name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                    style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
                    placeholder="Create a password"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                    style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
                    placeholder="Confirm your password"
                    required
                  />
                </div>

                {submitError && (
                  <div className="rounded-lg px-4 py-2.5 text-sm"
                       style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    {submitError}
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
                  {submitting ? 'Creating Account...' : 'Accept Invite & Create Account'}
                </button>
              </form>
            </>
          ) : null}
        </div>

        <p className="text-center text-xs text-text-tertiary mt-6">
          Recurrsive Engineering Intelligence Platform
        </p>
      </div>
    </div>
  );
}
