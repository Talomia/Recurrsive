'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useWebSocket, type UseWebSocketReturn } from '@/hooks/useWebSocket';

const RealtimeContext = createContext<UseWebSocketReturn | null>(null);

/** One authenticated WebSocket connection shared by the entire dashboard. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const realtime = useWebSocket({ autoConnect: Boolean(user) });
  return <RealtimeContext.Provider value={realtime}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): UseWebSocketReturn {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error('useRealtime must be used within RealtimeProvider');
  return context;
}
