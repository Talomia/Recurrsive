import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SkipToContent } from '@/components/SkipToContent';

export const metadata: Metadata = {
  title: {
    default: 'Recurrsive — Engineering Intelligence Platform',
    template: '%s | Recurrsive',
  },
  description:
    'Understand your entire software system. Get evidence-based recommendations ranked by business impact. From code and architecture to AI components, infrastructure, and costs.',
  keywords: [
    'engineering intelligence',
    'software analysis',
    'code analysis',
    'AI platform',
    'engineering decisions',
    'technical debt',
    'knowledge graph',
  ],
  openGraph: {
    title: 'Recurrsive — Engineering Intelligence Platform',
    description:
      'Understand your entire software system. Make better engineering decisions.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Recurrsive',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SkipToContent />
        <Navbar />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
