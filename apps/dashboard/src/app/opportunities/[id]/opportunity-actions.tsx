'use client';

/**
 * Client action bar for the (server-rendered) opportunity detail page.
 *
 * Wires the Accept / Dismiss buttons to the opportunity status API with toast
 * feedback and a server refresh so the persisted status is reflected.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { updateOpportunityStatus } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

type Decision = 'accepted' | 'rejected';

export default function OpportunityActions({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState<Decision | null>(null);
  const [decided, setDecided] = useState<Decision | null>(null);
  const [, startTransition] = useTransition();

  const decide = async (decision: Decision) => {
    setPending(decision);
    try {
      await updateOpportunityStatus(opportunityId, decision);
      setDecided(decision);
      toast(
        decision === 'accepted'
          ? 'Opportunity accepted.'
          : 'Opportunity dismissed.',
        decision === 'accepted' ? 'success' : 'info',
      );
      // Re-run the server component so the persisted status is reflected.
      startTransition(() => router.refresh());
    } catch {
      toast(
        `Failed to ${decision === 'accepted' ? 'accept' : 'dismiss'} opportunity. Please try again.`,
        'error',
      );
    } finally {
      setPending(null);
    }
  };

  if (decided) {
    const accepted = decided === 'accepted';
    return (
      <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] border border-white/5 p-5">
        <div className="text-sm text-text-muted">
          {accepted
            ? 'This opportunity has been accepted.'
            : 'This opportunity has been dismissed.'}
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium border ${
            accepted
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          {accepted ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
          {accepted ? 'Accepted' : 'Dismissed'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] border border-white/5 p-5">
      <div className="text-sm text-text-muted">
        Review this opportunity and take action
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => decide('rejected')}
          disabled={pending !== null}
          className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-60"
        >
          {pending === 'rejected' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <XCircle className="h-4 w-4" aria-hidden="true" />
          )}
          Dismiss
        </button>
        <button
          onClick={() => decide('accepted')}
          disabled={pending !== null}
          className="inline-flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-2 text-sm font-medium text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-60"
        >
          {pending === 'accepted' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
          Accept
        </button>
      </div>
    </div>
  );
}
