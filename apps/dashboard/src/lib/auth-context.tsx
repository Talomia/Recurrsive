/**
 * @module Dashboard Auth Context
 *
 * React context + provider for authentication state management.
 * Handles JWT token storage (localStorage), login/logout, and
 * auto-refresh on mount.
 *
 * @packageDocumentation
 */

'use client';

import {
  createContext,
  useCallback,
  useContext,

  useMemo,
  useState,
  type ReactNode,
} from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Role levels matching the server RBAC system. */
export type Role = 'admin' | 'analyst' | 'viewer';

/** Authenticated user information. */
export interface AuthUser {
  readonly userId: string;
  readonly username: string;
  readonly role: Role;
}

/** Auth context value exposed to consumers. */
export interface AuthContextValue {
  /** Current user, or null if not authenticated. */
  readonly user: AuthUser | null;
  /** JWT token string, or null if not authenticated. */
  readonly token: string | null;
  /** Whether auth state is being resolved (initial load/refresh). */
  readonly loading: boolean;
  /** Last auth error message, or null. */
  readonly error: string | null;
  /** Authenticate with username/password. */
  login(username: string, password: string): Promise<boolean>;
  /** Clear auth state and remove stored token. */
  logout(): void;
}

const TOKEN_KEY = 'recurrsive_token';
const API_BASE = '/api/v1';

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

/** Hook to access the current auth context. Throws if used outside AuthProvider. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

/** Decode a base64url string to a regular string (handles JWT encoding). */
function base64UrlDecode(input: string): string {
  // Convert base64url → standard base64
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return atob(padded);
}

/** Parse a simple JWT payload without verification (client-side only). */
function parseToken(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    if (!payload.sub || !payload.role) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    // username is now optional — use sub as fallback
    return {
      userId: payload.sub,
      username: payload.username ?? payload.sub,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return null;
    const parsed = parseToken(stored);
    if (!parsed) { localStorage.removeItem(TOKEN_KEY); return null; }
    return parsed;
  });
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return null;
    const parsed = parseToken(stored);
    return parsed ? stored : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Login failed' }));
        setError(body.error ?? 'Login failed');
        setLoading(false);
        return false;
      }

      const body = await res.json();
      const newToken = (body.data?.token ?? body.token) as string;
      const parsed = parseToken(newToken);

      if (!parsed) {
        setError('Invalid token received');
        setLoading(false);
        return false;
      }

      localStorage.setItem(TOKEN_KEY, newToken);
      // Also set as cookie for Next.js middleware (server-side auth)
      document.cookie = `${TOKEN_KEY}=${newToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''}`;
      setToken(newToken);
      setUser(parsed);
      setLoading(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    // Clear the auth cookie
    document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
    setToken(null);
    setUser(null);
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, loading, error, login, logout }),
    [user, token, loading, error, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
