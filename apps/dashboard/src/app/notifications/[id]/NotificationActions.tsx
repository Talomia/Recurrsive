'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Loader2, Trash2 } from 'lucide-react';
import { updateNotification } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export function NotificationActions({ id, read }: { id: string; read: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const [pending, setPending] = useState<'read' | 'dismiss' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = async (action: 'read' | 'dismiss') => {
    setPending(action);
    setError(null);
    try {
      await updateNotification(id, action === 'read' ? { read: true } : { dismissed: true });
      if (action === 'dismiss') router.push('/notifications');
      else router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update the notification.');
    } finally {
      setPending(null);
    }
  };

  if (user?.role !== 'admin') {
    return <p className="text-xs text-text-muted">Administrator access is required to update notifications.</p>;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => void update('dismiss')}
          disabled={pending !== null}
          className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
        >
          {pending === 'dismiss' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Dismiss
        </button>
        {!read && (
          <button
            type="button"
            onClick={() => void update('read')}
            disabled={pending !== null}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
          >
            {pending === 'read' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Mark as Read
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
