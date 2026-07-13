import Link from 'next/link';
import { FolderOpen } from 'lucide-react';

/** Actionable fallback for bookmarked project-scoped routes without a projectId. */
export default function ProjectScopeRequired({ feature = 'This view' }: { feature?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 pb-6 pt-20 text-center lg:pt-6">
      <div className="max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10">
          <FolderOpen className="h-7 w-7 text-blue-400" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-text-primary">Choose a project</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          {feature} is isolated by repository. Select a project to continue with the correct scope.
        </p>
        <Link href="/projects" className="mt-5 inline-flex rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white">
          Open projects
        </Link>
      </div>
    </div>
  );
}
