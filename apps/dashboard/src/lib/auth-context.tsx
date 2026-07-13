'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Role = 'admin' | 'analyst' | 'viewer';

export interface AuthUser {
  readonly userId: string;
  readonly username: string;
  readonly role: Role;
  readonly sessionExpiresAt?: number;
}

export interface AuthContextValue {
  readonly user: AuthUser | null;
  readonly loading: boolean;
  readonly error: string | null;
  login(username: string, password: string): Promise<boolean>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within <AuthProvider>');
  return context;
}

function mapUser(value: { id: string; username?: string; role: Role; sessionExpiresAt?: number }): AuthUser {
  return { userId: value.id, username: value.username ?? value.id, role: value.role, sessionExpiresAt: value.sessionExpiresAt };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = await response.json() as { data?: { id: string; username?: string; role: Role; sessionExpiresAt?: number } };
        return body.data ? mapUser(body.data) : null;
      })
      .then((resolvedUser) => { if (active) setUser(resolvedUser); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user?.sessionExpiresAt) return;
    const refreshInMs = Math.max(5_000, user.sessionExpiresAt * 1000 - Date.now() - 5 * 60_000);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/v1/auth/refresh', { method: 'POST' });
        const body = await response.json().catch(() => ({})) as {
          data?: { user?: { id: string; username?: string; role: Role; sessionExpiresAt?: number } };
        };
        if (!response.ok || !body.data?.user) {
          setUser(null);
          return;
        }
        setUser(mapUser(body.data.user));
      } catch {
        setUser(null);
      }
    }, refreshInMs);
    return () => window.clearTimeout(timer);
  }, [user?.sessionExpiresAt]);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const body = await response.json().catch(() => ({})) as {
        error?: string;
        message?: string;
        data?: { user?: { id: string; username?: string; role: Role; sessionExpiresAt?: number } };
      };
      if (!response.ok || !body.data?.user) {
        setError(body.message ?? body.error ?? 'Login failed');
        return false;
      }
      setUser(mapUser(body.data.user));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setError(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ user, loading, error, login, logout }), [user, loading, error, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
