'use client';

import { useSearchParams } from 'next/navigation';
import { Fragment, type ReactNode } from 'react';

/**
 * Remounts the page subtree whenever the active project (`?projectId=`)
 * changes, so client pages that fetch in a mount-effect re-run against the
 * newly-selected project. Without this, switching the project only rewrites the
 * URL and client components keep showing the previous project's data.
 *
 * Server components refetch via the navigation + `router.refresh()` in
 * switchProject; this handles the client side.
 */
export default function ScopedContent({ children }: { children: ReactNode }) {
  const projectId = useSearchParams().get('projectId') ?? 'none';
  return <Fragment key={projectId}>{children}</Fragment>;
}
