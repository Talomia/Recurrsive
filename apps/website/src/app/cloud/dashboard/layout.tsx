import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cloud Dashboard',
  description:
    'Review self-hosted deployment guidance, configuration, and operational status.',
};

export default function CloudDashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
