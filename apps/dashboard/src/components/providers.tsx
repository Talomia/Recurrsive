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
import { ActiveProjectProvider } from '@/components/active-project-context';
import { AssistantProvider } from '@/components/assistant-context';
import { ToastProvider } from '@/components/ui/toast';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <AuthGuard>
          <AssistantProvider>
            <ActiveProjectProvider>{children}</ActiveProjectProvider>
          </AssistantProvider>
        </AuthGuard>
      </AuthProvider>
    </ToastProvider>
  );
}
