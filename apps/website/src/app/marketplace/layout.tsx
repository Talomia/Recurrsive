import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Marketplace',
  description:
    'Browse and install community analyzers, collectors, and intelligence packs for the Recurrsive platform.',
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
