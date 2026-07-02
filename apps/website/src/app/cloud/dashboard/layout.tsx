import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cloud Dashboard',
  description:
    'Manage your Recurrsive Cloud deployment. View usage, configure settings, and monitor your engineering intelligence pipeline.',
};

export default function CloudDashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
