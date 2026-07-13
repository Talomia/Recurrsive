import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Key, Radio, Server, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'API Reference',
  description: 'Authentication, project analysis, status polling, and WebSocket streaming for the self-hosted Recurrsive API.',
};

const EVENTS = ['analysis:started', 'analysis:progress', 'analysis:finding', 'analysis:complete', 'analysis:error'];

export default function ApiReferencePage() {
  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      <section className="section" style={{ textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <span className="badge badge-accent"><BookOpen size={14} /> Self-Hosted REST API</span>
          <h1 style={{ marginTop: 'var(--space-lg)' }}>API <span className="text-gradient">Reference</span></h1>
          <p className="text-secondary" style={{ margin: 'var(--space-md) auto 0', maxWidth: 640 }}>
            Every deployment exposes its own authenticated API. Use the interactive OpenAPI document on your API service for the complete route and schema inventory.
          </p>
        </div>
      </section>

      <section className="section-sm">
        <div className="container" style={{ maxWidth: 900 }}>
          <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Server size={22} style={{ color: 'var(--cyan)' }} /><h2 style={{ fontSize: '1.35rem' }}>Base URL</h2></div>
            <div className="code-block" style={{ marginTop: 'var(--space-md)' }}>https://your-api-host.example/api/v1</div>
            <p className="text-secondary" style={{ marginTop: 'var(--space-md)', fontSize: '.9rem' }}>
              Liveness is public at <code>/health</code>. The machine-readable specification is public at <code>/api/v1/openapi.json</code>; all product data routes require authentication.
            </p>
          </div>

          <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Key size={22} style={{ color: 'var(--amber)' }} /><h2 style={{ fontSize: '1.35rem' }}>Authentication</h2></div>
            <p className="text-secondary" style={{ marginTop: 'var(--space-md)', fontSize: '.9rem' }}>Use a session JWT or an API key created by an administrator.</p>
            <div className="code-block" style={{ marginTop: 'var(--space-md)' }}>
              <div>Authorization: Bearer $TOKEN</div>
              <div style={{ marginTop: 8 }}>X-API-Key: $API_KEY</div>
            </div>
          </div>

          <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><ShieldCheck size={22} style={{ color: 'var(--green)' }} /><h2 style={{ fontSize: '1.35rem' }}>Analyze a registered project</h2></div>
            <p className="text-secondary" style={{ marginTop: 'var(--space-md)', fontSize: '.9rem' }}>Register a repository once, then submit its project ID. The trigger responds with HTTP 202 while cloning and analysis continue in the serialized worker.</p>
            <div className="code-block" style={{ marginTop: 'var(--space-md)', overflowX: 'auto' }}>
              <div>curl -X POST https://your-api-host.example/api/v1/projects </div>
              <div>&nbsp;&nbsp;-H &quot;Authorization: Bearer $TOKEN&quot; </div>
              <div>&nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; </div>
              <div>&nbsp;&nbsp;-d &apos;{'{"name":"My service","repository":"https://github.com/acme/service"}'}&apos;</div>
              <div style={{ marginTop: 16 }}>curl -X POST https://your-api-host.example/api/v1/analyze </div>
              <div>&nbsp;&nbsp;-H &quot;Authorization: Bearer $TOKEN&quot; </div>
              <div>&nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; </div>
              <div>&nbsp;&nbsp;-d &apos;{'{"projectId":"PROJECT_ID","include_reasoning":true}'}&apos;</div>
              <div style={{ marginTop: 16 }}>curl &quot;https://your-api-host.example/api/v1/analysis/status?projectId=PROJECT_ID&quot; </div>
              <div>&nbsp;&nbsp;-H &quot;Authorization: Bearer $TOKEN&quot;</div>
            </div>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Radio size={22} style={{ color: 'var(--green)' }} /><h2 style={{ fontSize: '1.35rem' }}>WebSocket progress</h2></div>
            <p className="text-secondary" style={{ marginTop: 'var(--space-md)', fontSize: '.9rem' }}>Never put a JWT in a WebSocket URL. Exchange it for a 60-second, single-use ticket over authenticated HTTPS, then connect with that opaque ticket.</p>
            <div className="code-block" style={{ marginTop: 'var(--space-md)', overflowX: 'auto' }}>
              <div>const ticketResponse = await fetch(&apos;/api/v1/auth/ws-ticket&apos;, {'{'}</div>
              <div>&nbsp;&nbsp;method: &apos;POST&apos;, headers: {'{'} Authorization: `Bearer ${'{'}token{'}'}` {'}'}</div>
              <div>{'}'});</div>
              <div>const {'{'} data {'}'} = await ticketResponse.json();</div>
              <div>const ws = new WebSocket(`wss://your-api-host.example/ws?ticket=${'{'}data.ticket{'}'}`);</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 'var(--space-md)' }}>
              {EVENTS.map((event) => <code key={event} style={{ color: 'var(--green)' }}>{event}</code>)}
            </div>
          </div>

          <p className="text-secondary" style={{ marginTop: 'var(--space-xl)', textAlign: 'center', fontSize: '.9rem' }}>
            Deployment variables, health checks, and proxy requirements are covered in the <Link href="/docs/deployment" style={{ color: 'var(--text-accent)' }}>deployment guide</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
