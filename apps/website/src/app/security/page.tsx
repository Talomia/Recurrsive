import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDocument, LegalSection } from '@/components/LegalDocument';

export const metadata: Metadata = { title: 'Security', description: 'Recurrsive security model, deployment responsibilities, and vulnerability disclosure.' };

export default function SecurityPage() {
  return (
    <LegalDocument label="Trust" title="Security" updated="July 13, 2026">
      <LegalSection title="Report a vulnerability">
        <p>Email security@recurrsive.dev with a description, reproduction steps, affected versions, and potential impact. Do not include live credentials or access data you are not authorized to disclose. The full disclosure process is in the repository <Link href="https://github.com/Talomia/Recurrsive/blob/main/SECURITY.md" style={{ color: 'var(--text-accent)' }}>security policy</Link>.</p>
      </LegalSection>
      <LegalSection title="Application controls">
        <p>Production startup rejects known JWT secrets, demo accounts, and missing CORS configuration. API access is authenticated by default, administrative actions use role checks, passwords are hashed, and containers run as non-root users.</p>
      </LegalSection>
      <LegalSection title="Repository processing">
        <p>Remote repositories are cloned into temporary storage for the duration of analysis. Operators should use least-privilege repository credentials, configure allowed paths, and protect derived findings because they may contain sensitive structural information.</p>
      </LegalSection>
      <LegalSection title="Deployment responsibilities">
        <p>The deployment owner controls domains, TLS, firewall policy, database security, backups, retention, identity-provider configuration, monitoring, and incident response. The project does not claim external security certifications or a universal uptime SLA.</p>
      </LegalSection>
      <LegalSection title="Supported versions">
        <p>Until stable tagged releases are published, security fixes are delivered on the latest supported release branch. Production operators should pin an audited commit or image and test upgrades before rollout.</p>
      </LegalSection>
    </LegalDocument>
  );
}
