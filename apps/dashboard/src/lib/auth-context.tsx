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
  refreshSession(): Promise<void>;
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

  const refreshSession = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/auth/me', { cache: 'no-store' });
      if (response.status === 401) {
        setUser(null);
        return;
      }
      const body = await response.json().catch(() => ({})) as {
        message?: string;
        error?: string;
        data?: { id: string; username?: string; role: Role; sessionExpiresAt?: number };
      };
      if (!response.ok) {
        throw new Error(body.message ?? body.error ?? `Session check failed (${response.status})`);
      }
      if (!body.data) throw new Error('Session response did not include a user.');
      setUser(mapUser(body.data));
    } catch (caught) {
      // A timeout, 429, or upstream failure is not proof that the session is
      // invalid. Preserve the current user and show a recoverable error.
      setError(caught instanceof Error ? caught.message : 'Unable to verify the current session.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!user?.sessionExpiresAt) return;
    const refreshInMs = Math.max(5_000, user.sessionExpiresAt * 1000 - Date.now() - 5 * 60_000);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/v1/auth/refresh', { method: 'POST' });
        const body = await response.json().catch(() => ({})) as {
          data?: { user?: { id: string; username?: string; role: Role; sessionExpiresAt?: number } };
        };
        if (response.status === 401) {
          setUser(null);
          return;
        }
        if (!response.ok || !body.data?.user) {
          setError('Session refresh failed. Your current session has been preserved.');
          return;
        }
        setError(null);
        setUser(mapUser(body.data.user));
      } catch {
        setError('Session refresh failed. Your current session has been preserved.');
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

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, error, login, logout, refreshSession }),
    [user, loading, error, login, logout, refreshSession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
