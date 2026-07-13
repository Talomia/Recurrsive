/**
 * @module Dashboard Login Page
 *
 * Authentication page for the Recurrsive platform.
 * Redirects to the main dashboard on successful login.
 *
 * @packageDocumentation
 */

'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';

interface SSOProvider {
  id: string;
  displayName: string;
  provider: string;
}

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams.get('redirect');
  const redirectTo = requestedRedirect?.startsWith('/') && !requestedRedirect.startsWith('//') ? requestedRedirect : '/';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [ssoProviders, setSsoProviders] = useState<SSOProvider[]>([]);

  // Check if setup is required (fresh install) — redirect before showing login
  useEffect(() => {
    let cancelled = false;
    async function checkSetup() {
      try {
        const status = await apiFetch<{ setupRequired: boolean }>('/api/v1/setup/status');
        if (!cancelled && status?.setupRequired) {
          router.replace('/setup');
        }
      } catch {
        // Endpoint not available — proceed with normal login
      }
    }
    checkSetup();
    apiFetch<SSOProvider[]>('/api/v1/sso/discovery').then((providers) => {
      if (!cancelled) setSsoProviders(providers);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const success = await login(username, password);
    if (success) {
      router.push(redirectTo);
    }
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
            Engineering Intelligence Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl p-8"
             style={{
               background: 'var(--color-surface)',
               border: '1px solid var(--color-border)',
               boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
             }}>
          <h2 className="text-lg font-semibold text-text-primary mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-username" className="block text-sm font-medium text-text-secondary mb-1.5">
                Username
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--color-base)',
                  border: '1px solid var(--color-border)',
                }}
                placeholder="Enter username"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-text-secondary mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--color-base)',
                  border: '1px solid var(--color-border)',
                }}
                placeholder="Enter password"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-lg px-4 py-2.5 text-sm"
                   style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200"
              style={{
                background: loading
                  ? 'var(--color-border)'
                  : 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {ssoProviders.length > 0 && (
            <div className="mt-6 border-t border-white/10 pt-6">
              <p className="mb-3 text-center text-xs text-text-tertiary">Or continue with single sign-on</p>
              <div className="space-y-2">
                {ssoProviders.map((provider) => (
                  <a
                    key={provider.id}
                    href={`/api/v1/sso/login/${encodeURIComponent(provider.id)}?returnTo=${encodeURIComponent(redirectTo)}`}
                    className="block w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-center text-sm font-medium text-text-primary hover:bg-white/10"
                  >
                    Continue with {provider.displayName}
                  </a>
                ))}
              </div>
            </div>
          )}

          <p className="mt-5 text-center text-xs text-text-tertiary">
            Cannot sign in? Contact a Recurrsive administrator to reset your account or restore access.
          </p>
        </div>

        <p className="text-center text-xs text-text-tertiary mt-6">
          Recurrsive Engineering Intelligence Platform
        </p>
      </div>
    </div>
  );
}
