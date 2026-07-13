import type { Metadata } from 'next';
import { LegalDocument, LegalSection } from '@/components/LegalDocument';

export const metadata: Metadata = { title: 'Privacy Policy', description: 'How Recurrsive handles website and self-hosted product data.' };

export default function PrivacyPage() {
  return (
    <LegalDocument label="Legal" title="Privacy Policy" updated="July 13, 2026">
      <LegalSection title="Scope">
        <p>This policy covers the Recurrsive website and project-operated services. A self-hosted organization controls its own Recurrsive deployment and is responsible for its users, retention, access, and legal basis for processing.</p>
      </LegalSection>
      <LegalSection title="Website submissions">
        <p>The contact form collects the information you enter, such as name, email, organization, subject, and message. Submissions are stored so they can be reviewed and answered. We do not sell this information.</p>
      </LegalSection>
      <LegalSection title="Repository analysis">
        <p>When a remote repository is analyzed, Recurrsive creates a temporary shallow clone, reads source and configuration files, produces derived entities, evidence, findings, and opportunities, and removes the temporary clone after the run. Derived analysis data is retained in the deployment&apos;s configured storage.</p>
      </LegalSection>
      <LegalSection title="Infrastructure and logs">
        <p>Operators may process IP addresses, request metadata, authentication events, and operational logs for security and reliability. Exact infrastructure providers and retention periods depend on the deployment owner.</p>
      </LegalSection>
      <LegalSection title="Retention and your choices">
        <p>Project-operated submissions are retained only while needed for the request, security, or record-keeping obligations. To request access, correction, or deletion, email privacy@recurrsive.dev. Self-hosted users should contact their deployment administrator.</p>
      </LegalSection>
      <LegalSection title="Security and international processing">
        <p>Reasonable technical safeguards are used, but no system is risk-free. Self-hosted data remains in locations chosen by the operator. Project communications may be processed where the project team and its infrastructure operate.</p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>Privacy questions can be sent to privacy@recurrsive.dev.</p>
      </LegalSection>
    </LegalDocument>
  );
}
