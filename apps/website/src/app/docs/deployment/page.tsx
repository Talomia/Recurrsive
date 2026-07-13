import type { Metadata } from 'next';
import Link from 'next/link';
import { DatabaseBackup, HeartPulse, KeyRound, Server, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Production Deployment',
  description: 'Deploy and operate Recurrsive on self-hosted EasyPanel or Docker Compose with PostgreSQL/AGE, explicit secrets, health checks, and backups.',
};

const REQUIRED_ENV = [
  ['DATABASE_URL', 'PostgreSQL connection URL using a strong, non-placeholder password'],
  ['GRAPH_PROVIDER', 'postgresql_age'],
  ['JWT_SECRET', 'Unique random value of at least 32 characters'],
  ['SECRETS_ENCRYPTION_KEY', 'Different unique random value of at least 32 characters'],
  ['CORS_ORIGIN', 'Comma-separated dashboard and website HTTPS origins'],
  ['TRUST_PROXY', 'true when the API is behind EasyPanel/Traefik'],
  ['RECURRSIVE_ALLOWED_GIT_HOSTS', 'Explicit comma-separated repository host allowlist'],
  ['PUBLIC_API_URL', 'Public HTTPS API origin, configured on the dashboard service'],
] as const;

export default function DeploymentPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      <section className="section" style={{ textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <span className="badge badge-accent"><Server size={14} /> Self-Hosted Production</span>
          <h1 style={{ marginTop: 'var(--space-lg)' }}>Production <span className="text-gradient">Deployment</span></h1>
          <p className="text-secondary" style={{ margin: 'var(--space-md) auto 0', maxWidth: 650 }}>
            Recurrsive runs in infrastructure you control. The repository includes an EasyPanel schema and a hardened Docker Compose stack; there is no managed Recurrsive cloud service.
          </p>
        </div>
      </section>

      <section className="section-sm">
        <div className="container" style={{ maxWidth: 920 }}>
          <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
            <h2 style={{ fontSize: '1.4rem' }}>EasyPanel deployment</h2>
            <ol className="text-secondary" style={{ marginTop: 'var(--space-md)', paddingLeft: 22, lineHeight: 1.9 }}>
              <li>Create a private fork or connect the repository to EasyPanel.</li>
              <li>Import <code>easypanel.json</code> with Create from Schema.</li>
              <li>Replace every <code>SET_IN_EASYPANEL_…</code> placeholder before the first API start.</li>
              <li>Use the same PostgreSQL password in the database service and <code>DATABASE_URL</code>.</li>
              <li>Attach durable volumes to PostgreSQL and <code>/app/data</code>.</li>
              <li>Set the API, dashboard, and website domains, then update <code>CORS_ORIGIN</code> and <code>PUBLIC_API_URL</code> to those exact HTTPS origins.</li>
              <li>Deploy PostgreSQL first, then API, dashboard, and website. Complete the setup wizard once at the dashboard URL.</li>
            </ol>
            <p className="text-secondary" style={{ marginTop: 'var(--space-md)', fontSize: '.9rem' }}>Production startup fails closed when database, JWT, encryption, or CORS configuration is missing or still uses a template placeholder.</p>
          </div>

          <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><KeyRound size={22} style={{ color: 'var(--amber)' }} /><h2 style={{ fontSize: '1.4rem' }}>Required environment</h2></div>
            <div style={{ overflowX: 'auto', marginTop: 'var(--space-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.88rem' }}>
                <tbody>{REQUIRED_ENV.map(([name, purpose]) => (
                  <tr key={name}><td style={{ padding: 12, borderBottom: '1px solid var(--border-subtle)' }}><code>{name}</code></td><td className="text-secondary" style={{ padding: 12, borderBottom: '1px solid var(--border-subtle)' }}>{purpose}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <div className="code-block" style={{ marginTop: 'var(--space-md)' }}>openssl rand -base64 48</div>
            <p className="text-secondary" style={{ marginTop: 8, fontSize: '.85rem' }}>Generate JWT and encryption keys separately. Keep them in EasyPanel secrets and in the backup recovery procedure; losing the encryption key makes locally stored secret values unrecoverable.</p>
          </div>

          <div className="grid-3" style={{ marginBottom: 'var(--space-xl)' }}>
            <div className="glass-card"><HeartPulse size={22} style={{ color: 'var(--green)' }} /><h3 style={{ marginTop: 10 }}>Health checks</h3><p className="text-secondary" style={{ marginTop: 8, fontSize: '.88rem' }}>API: <code>/health</code>. Dashboard: <code>/login</code>. Website: <code>/</code>. Keep EasyPanel health checks enabled and alert on repeated failures.</p></div>
            <div className="glass-card"><DatabaseBackup size={22} style={{ color: 'var(--cyan)' }} /><h3 style={{ marginTop: 10 }}>Backups</h3><p className="text-secondary" style={{ marginTop: 8, fontSize: '.88rem' }}>Back up PostgreSQL and the API data volume. Encrypt backups, retain multiple restore points, and test restoration on an isolated instance.</p></div>
            <div className="glass-card"><ShieldCheck size={22} style={{ color: 'var(--purple)' }} /><h3 style={{ marginTop: 10 }}>Network boundary</h3><p className="text-secondary" style={{ marginTop: 8, fontSize: '.88rem' }}>Expose only HTTPS application domains. Keep PostgreSQL internal, restrict repository hosts, and do not place JWTs or credentials in URLs.</p></div>
          </div>

          <div className="glass-card">
            <h2 style={{ fontSize: '1.4rem' }}>Upgrade and rollback</h2>
            <ol className="text-secondary" style={{ marginTop: 'var(--space-md)', paddingLeft: 22, lineHeight: 1.9 }}>
              <li>Review the changelog and take a verified database backup.</li>
              <li>Build immutable images from the chosen commit; do not deploy a floating unreviewed revision.</li>
              <li>Deploy the API and verify <code>/health</code>, then deploy the dashboard and website.</li>
              <li>Run authenticated smoke tests for login, project reads, analysis status, and public form submission.</li>
              <li>If verification fails, restore the previous image revision. Restore data only when a migration requires it.</li>
            </ol>
          </div>

          <p className="text-secondary" style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
            See the repository <Link href="https://github.com/Talomia/Recurrsive/blob/main/docs/DEPLOYMENT.md" style={{ color: 'var(--text-accent)' }}>operations guide</Link> for command-line details.
          </p>
        </div>
      </section>
    </div>
  );
}
