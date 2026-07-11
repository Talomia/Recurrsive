import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="glass-card p-8 max-w-md w-full text-center">
        <div
          className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: 'rgba(59, 130, 246, 0.1)' }}
        >
          <FileQuestion className="h-8 w-8 text-blue-400" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-text-primary mb-2">Page not found</h2>
        <p className="text-text-secondary mb-6 text-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary))' }}
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
