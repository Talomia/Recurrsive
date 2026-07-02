import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch with the Recurrsive team. Enterprise inquiries, partnership opportunities, and technical support.',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
