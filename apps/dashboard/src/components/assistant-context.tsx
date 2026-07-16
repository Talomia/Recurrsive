'use client';

/**
 * @module Assistant Availability Context
 *
 * Tracks the REAL availability of the AI assistant so the sidebar badge, the
 * header, and the chat panel all tell the same truth — never a hardcoded
 * "Ready"/"Online" claim.
 *
 * Availability is learned from the assistant endpoint itself: a lightweight
 * probe on first authenticated mount, and updated on every real chat response.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/lib/auth-context';
import { probeAssistant } from '@/lib/api/assistant';

/**
 * - `unknown`     — not yet determined (no claim made)
 * - `available`   — server answered successfully (LLM configured)
 * - `unavailable` — server reports no LLM key configured
 */
export type AssistantAvailability = 'unknown' | 'available' | 'unavailable';

interface AssistantContextValue {
  availability: AssistantAvailability;
  /** Optional human-readable reason when unavailable. */
  reason: string | null;
  /** Update availability from a real chat/probe result. */
  reportStatus: (status: 'ok' | 'unavailable' | 'error', reason?: string) => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [availability, setAvailability] = useState<AssistantAvailability>('unknown');
  const [reason, setReason] = useState<string | null>(null);

  const reportStatus = useCallback(
    (status: 'ok' | 'unavailable' | 'error', r?: string) => {
      if (status === 'ok') {
        setAvailability('available');
        setReason(null);
      } else if (status === 'unavailable') {
        setAvailability('unavailable');
        setReason(r ?? 'Configure an LLM key to enable the assistant.');
      }
      // 'error' (transport failure) leaves the last known state untouched.
    },
    [],
  );

  // Probe availability once we have an authenticated session.
  useEffect(() => {
    if (!user) {
      setAvailability('unknown');
      setReason(null);
      return;
    }
    let cancelled = false;
    probeAssistant().then((res) => {
      if (cancelled) return;
      if (res.status === 'ok') {
        setAvailability('available');
        setReason(null);
      } else if (res.status === 'unavailable') {
        setAvailability('unavailable');
        setReason(res.reason ?? 'Configure an LLM key to enable the assistant.');
      }
      // 'error' → stay 'unknown' (neutral, no false claim).
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const value = useMemo<AssistantContextValue>(
    () => ({ availability, reason, reportStatus }),
    [availability, reason, reportStatus],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant(): AssistantContextValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant must be used within an AssistantProvider');
  return ctx;
}
