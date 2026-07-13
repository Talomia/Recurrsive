import type { Metadata } from 'next';
import { LegalDocument, LegalSection } from '@/components/LegalDocument';

export const metadata: Metadata = { title: 'Terms of Use', description: 'Terms governing the Recurrsive website, software, and submissions.' };

export default function TermsPage() {
  return (
    <LegalDocument label="Legal" title="Terms of Use" updated="July 13, 2026">
      <LegalSection title="Open-source software">
        <p>The Recurrsive software is offered under the Apache License 2.0. Your use, modification, and distribution of the software is governed by that license. These website terms do not replace it.</p>
      </LegalSection>
      <LegalSection title="Website and submissions">
        <p>You may use the website and submit legitimate inquiries. You must not submit unlawful content, malware, secrets you are not authorized to disclose, or material that infringes another party&apos;s rights.</p>
      </LegalSection>
      <LegalSection title="Repository authorization">
        <p>You may analyze only repositories and systems you are authorized to access. You remain responsible for credentials, access rights, data classification, and the consequences of changes made from analysis results.</p>
      </LegalSection>
      <LegalSection title="Engineering recommendations">
        <p>Findings and opportunities are decision support, not a substitute for engineering review. Validate evidence, assumptions, security impact, and rollback plans before implementation.</p>
      </LegalSection>
      <LegalSection title="Support and services">
        <p>Production support or implementation work is governed only by a separate written agreement. No service level, response time, certification, managed hosting, or warranty is created by the public website.</p>
      </LegalSection>
      <LegalSection title="Warranty and liability">
        <p>To the extent permitted by law, the website and open-source software are provided as-is and without warranties. Liability relating to separately contracted services is governed by the applicable agreement.</p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>Questions about these terms can be sent to legal@recurrsive.dev.</p>
      </LegalSection>
    </LegalDocument>
  );
}
