/**
 * @module Dashboard Login Page
 *
 * Authentication page with demo credentials.
 * Redirects to the main dashboard on successful login.
 *
 * @packageDocumentation
 */

'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';

/** Demo users for the login form helper. */
const DEMO_USERS = [
  { username: 'admin', password: 'admin', role: 'Admin', desc: 'Full access' },
  { username: 'analyst', password: 'analyst', role: 'Analyst', desc: 'Read/write analysis' },
  { username: 'viewer', password: 'viewer', role: 'Viewer', desc: 'Read-only access' },
] as const;

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const success = await login(username, password);
    if (success) {
      router.push(redirectTo);
    }
  }

  async function handleDemoLogin(user: string, pass: string) {
    setUsername(user);
    setPassword(pass);
    const success = await login(user, pass);
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
        </div>

        {/* Demo Credentials */}
        <div className="mt-6 rounded-xl p-5"
             style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--color-border)' }}>
          <p className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">
            Demo Accounts
          </p>
          <div className="space-y-2">
            {DEMO_USERS.map((demo) => (
              <button
                key={demo.username}
                onClick={() => handleDemoLogin(demo.username, demo.password)}
                disabled={loading}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm transition-all duration-150 hover:scale-[1.01]"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                        style={{
                          background: demo.role === 'Admin'
                            ? 'rgba(139, 92, 246, 0.2)'
                            : demo.role === 'Analyst'
                              ? 'rgba(59, 130, 246, 0.2)'
                              : 'rgba(107, 114, 128, 0.2)',
                          color: demo.role === 'Admin'
                            ? '#8b5cf6'
                            : demo.role === 'Analyst'
                              ? '#3b82f6'
                              : '#6b7280',
                        }}>
                    {demo.role[0]}
                  </span>
                  <div className="text-left">
                    <span className="text-text-primary font-medium">{demo.username}</span>
                    <span className="text-text-tertiary ml-2 text-xs">{demo.desc}</span>
                  </div>
                </div>
                <span className="text-text-tertiary text-xs">{demo.role}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-text-tertiary mt-6">
          Demo instance — no real authentication required
        </p>
      </div>
    </div>
  );
}
