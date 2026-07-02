'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Server,
  Activity,
  BarChart3,
  Users,
  FileText,
  Play,
  Cpu,
  HardDrive,
  Database,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Globe,
  Zap,
  RefreshCw,
  Settings,
} from 'lucide-react';

const METRICS = [
  { label: 'API Calls (this month)', value: '1,247,382', change: '+12.4%', color: 'var(--purple)' },
  { label: 'Storage Used', value: '42.7 GB', change: '+3.1%', color: 'var(--blue)' },
  { label: 'Analysis Runs', value: '1,893', change: '+8.7%', color: 'var(--cyan)' },
  { label: 'Active Users', value: '34', change: '+2', color: 'var(--green)' },
];

const QUICK_ACTIONS = [
  { icon: Play, label: 'Run Analysis', color: 'var(--purple)', href: '#' },
  { icon: FileText, label: 'View Reports', color: 'var(--blue)', href: '#' },
  { icon: Users, label: 'Manage Users', color: 'var(--cyan)', href: '#' },
  { icon: Settings, label: 'Settings', color: 'var(--amber)', href: '#' },
];

const ACTIVITY = [
  { type: 'success', message: 'Analysis completed on frontend-app', user: 'Sarah K.', time: '2 min ago' },
  { type: 'info', message: 'New user invited: mark@company.com', user: 'Admin', time: '18 min ago' },
  { type: 'success', message: 'Security scan passed — 0 vulnerabilities', user: 'CI Pipeline', time: '45 min ago' },
  { type: 'warning', message: 'Storage usage above 80% threshold', user: 'System', time: '1 hour ago' },
  { type: 'success', message: 'Weekly report generated and emailed', user: 'Scheduler', time: '3 hours ago' },
];

const RESOURCES = [
  { label: 'CPU', used: 42, total: 100, unit: '%', color: 'var(--purple)' },
  { label: 'Memory', used: 6.2, total: 16, unit: 'GB', color: 'var(--blue)' },
  { label: 'Storage', used: 42.7, total: 100, unit: 'GB', color: 'var(--cyan)' },
];

export default function CloudDashboardPage() {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  return (
    <div style={{ paddingTop: 'var(--nav-height)' }}>
      {/* Hero */}
      <section
        className="section"
        style={{ position: 'relative', overflow: 'hidden', paddingBottom: 'var(--space-2xl)' }}
      >
        <div
          className="glow-orb glow-purple"
          style={{ width: 500, height: 500, top: -200, right: -100 }}
        />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
            <div>
              <div className="badge badge-accent" style={{ marginBottom: 'var(--space-sm)' }}>
                <LayoutDashboard size={14} /> Cloud Console
              </div>
              <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)' }}>
                <span className="text-gradient">Cloud Dashboard</span>
              </h1>
            </div>
            <button
              className="btn btn-secondary"
              onClick={handleRefresh}
              style={{ gap: '8px' }}
            >
              <RefreshCw size={16} style={{ transition: 'transform 0.3s', transform: refreshing ? 'rotate(360deg)' : 'none' }} />
              Refresh
            </button>
          </div>

          {/* Instance Overview */}
          <div
            className="glass-card"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-xl)',
              flexWrap: 'wrap',
              marginBottom: 'var(--space-xl)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(34, 197, 94, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                flexShrink: 0,
              }}
            >
              <Server size={28} style={{ color: 'var(--green)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                <h3 style={{ fontSize: '1.15rem' }}>recurrsive-prod-01</h3>
                <span className="badge badge-green" style={{ padding: '4px 10px', fontSize: '0.72rem' }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'var(--green)',
                      display: 'inline-block',
                    }}
                  />
                  Running
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                <Globe size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                US East (Virginia) · Growth Plan · Uptime 99.99%
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <Link href="/cloud/billing" className="btn btn-secondary btn-sm">
                Billing
              </Link>
              <Link href="#" className="btn btn-primary btn-sm">
                Manage <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics */}
      <section className="section-sm">
        <div className="container">
          <div className="grid-4">
            {METRICS.map((m) => (
              <div key={m.label} className="glass-card" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  {m.label}
                </p>
                <p style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '4px', color: m.color }}>
                  {m.value}
                </p>
                <p style={{ fontSize: '0.82rem', color: 'var(--green)', fontWeight: 600 }}>
                  {m.change}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Actions & Activity Feed */}
      <section className="section-sm" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="grid-2">
            {/* Quick Actions */}
            <div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-lg)' }}>
                Quick Actions
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                {QUICK_ACTIONS.map((action) => (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="glass-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: 'var(--space-md)',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: `color-mix(in srgb, ${action.color} 15%, transparent)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid color-mix(in srgb, ${action.color} 25%, transparent)`,
                        flexShrink: 0,
                      }}
                    >
                      <action.icon size={20} style={{ color: action.color }} />
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Activity Feed */}
            <div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-lg)' }}>
                Recent Activity
              </h3>
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                {ACTIVITY.map((event, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '14px 20px',
                      borderBottom: i < ACTIVITY.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                    }}
                  >
                    {event.type === 'success' && <CheckCircle2 size={16} style={{ color: 'var(--green)', marginTop: 2, flexShrink: 0 }} />}
                    {event.type === 'info' && <Activity size={16} style={{ color: 'var(--blue)', marginTop: 2, flexShrink: 0 }} />}
                    {event.type === 'warning' && <AlertTriangle size={16} style={{ color: 'var(--amber)', marginTop: 2, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.88rem', marginBottom: '2px' }}>{event.message}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {event.user} · {event.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Resource Usage */}
      <section className="section-sm">
        <div className="container">
          <h3 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-lg)' }}>
            Resource Usage
          </h3>
          <div className="grid-3">
            {RESOURCES.map((r) => {
              const pct = (r.used / r.total) * 100;
              return (
                <div key={r.label} className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{r.label}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {r.used} / {r.total} {r.unit}
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: 10,
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(255,255,255,0.06)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        borderRadius: 'var(--radius-full)',
                        background: r.color,
                        transition: 'width 0.8s ease',
                      }}
                    />
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '6px', textAlign: 'right' }}>
                    {pct.toFixed(0)}% used
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ position: 'relative', overflow: 'hidden' }}>
        <div
          className="glow-orb glow-cyan"
          style={{ width: 400, height: 400, bottom: -150, left: -100 }}
        />
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="divider-gradient" style={{ marginBottom: 'var(--space-3xl)' }} />
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Need More <span className="text-gradient">Resources</span>?
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              maxWidth: 500,
              margin: '0 auto var(--space-xl)',
              fontSize: '1.05rem',
              lineHeight: 1.7,
            }}
          >
            Upgrade your plan for higher limits, dedicated GPU access, and priority support.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/cloud/billing" className="btn btn-primary btn-lg">
              <Zap size={18} /> Upgrade Plan
            </Link>
            <Link href="/cloud" className="btn btn-secondary btn-lg">
              View Plans <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
