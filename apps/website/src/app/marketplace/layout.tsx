import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Marketplace',
  description:
    'Browse the built-in analyzers and community extensions for the Recurrsive platform, and build your own with the Plugin SDK.',
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
