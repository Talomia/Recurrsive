/**
 * @module Dashboard Providers
 *
 * Client-side wrapper combining all context providers.
 * Used in the root layout to wrap the application.
 *
 * @packageDocumentation
 */

'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { AuthGuard } from '@/components/auth-guard';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>{children}</AuthGuard>
    </AuthProvider>
  );
}
