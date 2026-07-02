import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Server,
  ArrowRight,
  Container,
  Database,
  Globe,
  Shield,
  Activity,
  Cloud,
  CheckCircle2,
  Settings,
  AlertTriangle,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Deployment Guide — Recurrsive Docs',
  description:
    'Deploy Recurrsive in production with Docker Compose, Kubernetes, or Recurrsive Cloud. Includes environment config and monitoring.',
};

const ENV_VARS = [
  { name: 'DATABASE_URL', required: true, desc: 'PostgreSQL connection string', example: 'postgresql://user:pass@localhost:5432/recurrsive' },
  { name: 'GRAPH_PROVIDER', required: true, desc: 'Graph database backend', example: 'age | sqlite' },
  { name: 'JWT_SECRET', required: true, desc: '256-bit secret for JWT token signing', example: 'openssl rand -hex 32' },
  { name: 'API_PORT', required: false, desc: 'Port for the REST API server', example: '3000' },
  { name: 'REDIS_URL', required: false, desc: 'Redis for caching and job queues', example: 'redis://localhost:6379' },
  { name: 'LOG_LEVEL', required: false, desc: 'Logging verbosity', example: 'info | debug | warn | error' },
  { name: 'CORS_ORIGINS', required: false, desc: 'Allowed CORS origins (comma-separated)', example: 'https://app.example.com' },
  { name: 'STORAGE_PATH', required: false, desc: 'Path for local file storage', example: '/data/recurrsive' },
  { name: 'ENCRYPTION_KEY', required: false, desc: 'Key for encrypting secrets at rest', example: 'openssl rand -hex 32' },
  { name: 'TELEMETRY_ENDPOINT', required: false, desc: 'OTLP endpoint for observability', example: 'http://localhost:4318' },
];

export default function DeploymentPage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section
        className="section"
        style={{ position: 'relative', overflow: 'hidden', paddingBottom: 'var(--space-2xl)' }}
      >
        <div className="glow-orb glow-blue" style={{ width: 500, height: 500, top: -200, left: '30%' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-lg)' }}>
            <Server size={14} /> Production Ready
          </div>
          <h1 style={{ marginBottom: 'var(--space-md)' }}>
            <span className="text-gradient">Deployment Guide</span>
          </h1>
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              color: 'var(--text-secondary)',
              maxWidth: 600,
              margin: '0 auto',
              lineHeight: 1.7,
            }}
          >
            Deploy Recurrsive in production with Docker Compose, Kubernetes, or let us handle
            infrastructure with Recurrsive Cloud.
          </p>
        </div>
      </section>

      {/* Docker Compose */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-md)' }}>
            <Container size={28} style={{ color: 'var(--blue)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>
              Docker Compose <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>Recommended</span>
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)', lineHeight: 1.7 }}>
            The fastest path to a production-ready deployment. Includes PostgreSQL with Apache AGE,
            the API server, the dashboard, and Redis.
          </p>
          <div className="code-block" style={{ fontSize: '0.82rem' }}>
            <div><span className="comment"># docker-compose.yml</span></div>
            <div><span className="keyword">version</span>: <span className="string">&apos;3.9&apos;</span></div>
            <div><span className="keyword">services</span>:</div>
            <div>{'  '}<span className="function">postgres</span>:</div>
            <div>{'    '}<span className="keyword">image</span>: <span className="string">apache/age:latest</span></div>
            <div>{'    '}<span className="keyword">environment</span>:</div>
            <div>{'      '}<span className="keyword">POSTGRES_DB</span>: <span className="string">recurrsive</span></div>
            <div>{'      '}<span className="keyword">POSTGRES_USER</span>: <span className="string">recurrsive</span></div>
            <div>{'      '}<span className="keyword">POSTGRES_PASSWORD</span>: <span className="string">${'{'}<span className="keyword">DB_PASSWORD</span>{'}'}</span></div>
            <div>{'    '}<span className="keyword">ports</span>: [<span className="string">&quot;5432:5432&quot;</span>]</div>
            <div>{'    '}<span className="keyword">volumes</span>: [<span className="string">&quot;pgdata:/var/lib/postgresql/data&quot;</span>]</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="function">redis</span>:</div>
            <div>{'    '}<span className="keyword">image</span>: <span className="string">redis:7-alpine</span></div>
            <div>{'    '}<span className="keyword">ports</span>: [<span className="string">&quot;6379:6379&quot;</span>]</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="function">api</span>:</div>
            <div>{'    '}<span className="keyword">image</span>: <span className="string">ghcr.io/talomia/recurrsive-api:latest</span></div>
            <div>{'    '}<span className="keyword">ports</span>: [<span className="string">&quot;3000:3000&quot;</span>]</div>
            <div>{'    '}<span className="keyword">environment</span>:</div>
            <div>{'      '}<span className="keyword">DATABASE_URL</span>: <span className="string">postgresql://recurrsive:${'{'}<span className="keyword">DB_PASSWORD</span>{'}'}@postgres:5432/recurrsive</span></div>
            <div>{'      '}<span className="keyword">GRAPH_PROVIDER</span>: <span className="string">age</span></div>
            <div>{'      '}<span className="keyword">REDIS_URL</span>: <span className="string">redis://redis:6379</span></div>
            <div>{'      '}<span className="keyword">JWT_SECRET</span>: <span className="string">${'{'}<span className="keyword">JWT_SECRET</span>{'}'}</span></div>
            <div>{'    '}<span className="keyword">depends_on</span>: [<span className="string">postgres</span>, <span className="string">redis</span>]</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="function">dashboard</span>:</div>
            <div>{'    '}<span className="keyword">image</span>: <span className="string">ghcr.io/talomia/recurrsive-dashboard:latest</span></div>
            <div>{'    '}<span className="keyword">ports</span>: [<span className="string">&quot;3001:3001&quot;</span>]</div>
            <div>{'    '}<span className="keyword">environment</span>:</div>
            <div>{'      '}<span className="keyword">API_URL</span>: <span className="string">http://api:3000</span></div>
            <div style={{ marginTop: 8 }}><span className="keyword">volumes</span>:</div>
            <div>{'  '}<span className="function">pgdata</span>:</div>
          </div>
        </div>
      </section>

      {/* Environment Variables */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Settings size={28} style={{ color: 'var(--text-accent)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Environment Variables</h2>
          </div>
          <div
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'grid', gridTemplateColumns: '180px 60px 1fr',
                gap: 'var(--space-md)', padding: 'var(--space-md) var(--space-lg)',
                background: 'var(--bg-tertiary)', fontWeight: 700, fontSize: '0.78rem',
                color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}
            >
              <div>Variable</div>
              <div>Req&apos;d</div>
              <div>Description</div>
            </div>
            {ENV_VARS.map((v, i) => (
              <div
                key={v.name}
                style={{
                  display: 'grid', gridTemplateColumns: '180px 60px 1fr',
                  gap: 'var(--space-md)', padding: 'var(--space-md) var(--space-lg)',
                  borderTop: '1px solid var(--border-subtle)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--cyan)', wordBreak: 'break-all' }}>
                  {v.name}
                </div>
                <div>
                  {v.required ? (
                    <CheckCircle2 size={16} style={{ color: 'var(--green)' }} />
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>—</span>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                    {v.desc}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                    {v.example}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PostgreSQL + AGE */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Database size={28} style={{ color: 'var(--green)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>PostgreSQL + Apache AGE</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
            Recurrsive uses <strong style={{ color: 'var(--text-primary)' }}>Apache AGE</strong> — a
            graph extension for PostgreSQL — as its primary knowledge graph store. This provides ACID
            transactions and Cypher queries on top of standard PostgreSQL.
          </p>
          <div className="code-block" style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Enable the AGE extension</span>
            </div>
            <div><span className="keyword">CREATE</span> EXTENSION <span className="function">age</span>;</div>
            <div><span className="keyword">LOAD</span> <span className="string">&apos;age&apos;</span>;</div>
            <div><span className="keyword">SET</span> search_path = ag_catalog, <span className="string">&quot;$user&quot;</span>, public;</div>
            <div style={{ marginTop: 12, marginBottom: 4 }}>
              <span className="comment"># Create the knowledge graph</span>
            </div>
            <div><span className="keyword">SELECT</span> create_graph(<span className="string">&apos;recurrsive&apos;</span>);</div>
          </div>
          <div
            className="glass-card"
            style={{ padding: 'var(--space-md) var(--space-lg)', borderLeft: '3px solid var(--green)' }}
          >
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Alternative:</strong> For local development,
              Recurrsive falls back to an embedded <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>SQLite</span> graph store. Set{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>GRAPH_PROVIDER=sqlite</span> to
              use it.
            </div>
          </div>
        </div>
      </section>

      {/* Kubernetes */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Globe size={28} style={{ color: 'var(--purple)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Kubernetes Deployment</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
            For larger teams, deploy Recurrsive on Kubernetes with the included Helm chart or raw
            manifests.
          </p>
          <div className="code-block" style={{ fontSize: '0.82rem', marginBottom: 'var(--space-lg)' }}>
            <div><span className="comment"># deployment.yaml</span></div>
            <div><span className="keyword">apiVersion</span>: <span className="string">apps/v1</span></div>
            <div><span className="keyword">kind</span>: <span className="string">Deployment</span></div>
            <div><span className="keyword">metadata</span>:</div>
            <div>{'  '}<span className="keyword">name</span>: <span className="string">recurrsive-api</span></div>
            <div>{'  '}<span className="keyword">labels</span>:</div>
            <div>{'    '}<span className="keyword">app</span>: <span className="string">recurrsive</span></div>
            <div><span className="keyword">spec</span>:</div>
            <div>{'  '}<span className="keyword">replicas</span>: <span className="number">3</span></div>
            <div>{'  '}<span className="keyword">selector</span>:</div>
            <div>{'    '}<span className="keyword">matchLabels</span>:</div>
            <div>{'      '}<span className="keyword">app</span>: <span className="string">recurrsive</span></div>
            <div>{'  '}<span className="keyword">template</span>:</div>
            <div>{'    '}<span className="keyword">spec</span>:</div>
            <div>{'      '}<span className="keyword">containers</span>:</div>
            <div>{'        '}- <span className="keyword">name</span>: <span className="string">api</span></div>
            <div>{'          '}<span className="keyword">image</span>: <span className="string">ghcr.io/talomia/recurrsive-api:latest</span></div>
            <div>{'          '}<span className="keyword">ports</span>:</div>
            <div>{'            '}- <span className="keyword">containerPort</span>: <span className="number">3000</span></div>
            <div>{'          '}<span className="keyword">envFrom</span>:</div>
            <div>{'            '}- <span className="keyword">secretRef</span>:</div>
            <div>{'                '}<span className="keyword">name</span>: <span className="string">recurrsive-secrets</span></div>
            <div>{'          '}<span className="keyword">resources</span>:</div>
            <div>{'            '}<span className="keyword">requests</span>:</div>
            <div>{'              '}<span className="keyword">cpu</span>: <span className="string">&quot;500m&quot;</span></div>
            <div>{'              '}<span className="keyword">memory</span>: <span className="string">&quot;512Mi&quot;</span></div>
            <div>{'            '}<span className="keyword">limits</span>:</div>
            <div>{'              '}<span className="keyword">cpu</span>: <span className="string">&quot;2000m&quot;</span></div>
            <div>{'              '}<span className="keyword">memory</span>: <span className="string">&quot;2Gi&quot;</span></div>
          </div>
        </div>
      </section>

      {/* Nginx Reverse Proxy */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Shield size={28} style={{ color: 'var(--amber)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Reverse Proxy (nginx)</h2>
          </div>
          <div className="code-block" style={{ fontSize: '0.82rem' }}>
            <div><span className="comment"># /etc/nginx/sites-available/recurrsive</span></div>
            <div><span className="keyword">server</span> {'{'}</div>
            <div>{'  '}<span className="keyword">listen</span> <span className="number">443</span> <span className="string">ssl http2</span>;</div>
            <div>{'  '}<span className="keyword">server_name</span> <span className="string">recurrsive.example.com</span>;</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="keyword">ssl_certificate</span> <span className="string">/etc/letsencrypt/live/recurrsive.example.com/fullchain.pem</span>;</div>
            <div>{'  '}<span className="keyword">ssl_certificate_key</span> <span className="string">/etc/letsencrypt/live/recurrsive.example.com/privkey.pem</span>;</div>
            <div style={{ marginTop: 8 }}>{'  '}<span className="keyword">location</span> <span className="string">/api/</span> {'{'}</div>
            <div>{'    '}<span className="keyword">proxy_pass</span> <span className="string">http://localhost:3000</span>;</div>
            <div>{'    '}<span className="keyword">proxy_set_header</span> Host <span className="string">$host</span>;</div>
            <div>{'    '}<span className="keyword">proxy_set_header</span> X-Real-IP <span className="string">$remote_addr</span>;</div>
            <div>{'  }'}</div>
            <div style={{ marginTop: 4 }}>{'  '}<span className="keyword">location</span> <span className="string">/</span> {'{'}</div>
            <div>{'    '}<span className="keyword">proxy_pass</span> <span className="string">http://localhost:3001</span>;</div>
            <div>{'  }'}</div>
            <div>{'}'}</div>
          </div>
        </div>
      </section>

      {/* Recurrsive Cloud */}
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Cloud size={28} style={{ color: 'var(--cyan)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>
              Recurrsive <span className="text-gradient">Cloud</span>
            </h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)', lineHeight: 1.7 }}>
            Skip infrastructure management entirely. Recurrsive Cloud provides a fully managed
            deployment with automatic scaling, backups, and updates.
          </p>
          <div className="grid-3">
            {[
              { title: 'Managed Infrastructure', desc: 'Auto-scaling, HA, zero-downtime deploys' },
              { title: 'Automatic Backups', desc: 'Daily backups with 30-day retention' },
              { title: 'SOC 2 Compliant', desc: 'Enterprise security and audit controls' },
            ].map((item) => (
              <div key={item.title} className="glass-card" style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
                <CheckCircle2 size={24} style={{ color: 'var(--green)', marginBottom: 'var(--space-sm)' }} />
                <h4 style={{ fontSize: '0.95rem', marginBottom: 4 }}>{item.title}</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Monitoring */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-xl)' }}>
            <Activity size={28} style={{ color: 'var(--green)' }} />
            <h2 style={{ fontSize: '1.5rem' }}>Monitoring &amp; Health Checks</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.7 }}>
            Recurrsive exposes health-check endpoints and supports OpenTelemetry for full
            observability.
          </p>
          <div className="code-block" style={{ marginBottom: 'var(--space-lg)' }}>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Liveness probe</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="function">GET</span> <span className="string">/api/v1/health/live</span>
              {'  '}→{'  '}<span className="keyword">200</span> {'{'} <span className="string">&quot;status&quot;: &quot;ok&quot;</span> {'}'}
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Readiness probe (checks database connectivity)</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="function">GET</span> <span className="string">/api/v1/health/ready</span>
              {'  '}→{'  '}<span className="keyword">200</span> {'{'} <span className="string">&quot;status&quot;: &quot;ok&quot;</span>, <span className="string">&quot;db&quot;: &quot;connected&quot;</span> {'}'}
            </div>
            <div style={{ marginBottom: 4 }}>
              <span className="comment"># Version endpoint</span>
            </div>
            <div>
              <span className="function">GET</span> <span className="string">/api/v1/health/version</span>
              {'  '}→{'  '}<span className="keyword">200</span> {'{'} <span className="string">&quot;version&quot;: &quot;2.4.0&quot;</span>, <span className="string">&quot;commit&quot;: &quot;a1b2c3d&quot;</span> {'}'}
            </div>
          </div>
          <div
            className="glass-card"
            style={{ padding: 'var(--space-md) var(--space-lg)', borderLeft: '3px solid var(--green)' }}
          >
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text-primary)' }}>OpenTelemetry:</strong> Set{' '}
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>TELEMETRY_ENDPOINT</span> to
              export traces, metrics, and logs via OTLP. Compatible with Grafana, Datadog, and
              Honeycomb.
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="glow-orb glow-blue" style={{ width: 400, height: 400, bottom: -150, left: '50%', transform: 'translateX(-50%)' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Ready to <span className="text-gradient">Deploy?</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto var(--space-xl)', lineHeight: 1.7 }}>
            Start with Docker Compose for the fastest path, or explore Recurrsive Cloud for managed hosting.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <Link href="/cloud" className="btn btn-primary btn-lg">
              Try Recurrsive Cloud <ArrowRight size={18} />
            </Link>
            <Link href="/docs/architecture" className="btn btn-secondary btn-lg">
              Architecture Guide
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
