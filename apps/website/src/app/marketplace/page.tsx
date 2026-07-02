'use client';

import { useState } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Store,
  Search,
  Star,
  Download,
  CheckCircle2,
  Boxes,
  Gauge,
  ShieldCheck,
  DollarSign,
  Database,
  FileText,
  GitBranch,
  FileCode2,
  Package,
  Code2,
  Activity,
  Brain,
  Cpu,
  Container,
  HeartPulse,
  TrendingUp,
  ArrowRight,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';

const CATEGORIES = ['All', 'Analyzers', 'Collectors', 'Policies', 'Intelligence Packs'] as const;
type Category = (typeof CATEGORIES)[number];

interface Extension {
  name: string;
  author: string;
  description: string;
  icon: React.ElementType;
  category: Category | string;
  downloads: string;
  rating: number;
  source: 'Built-in' | 'Community';
  installed: boolean;
  color: string;
}

const EXTENSIONS: Extension[] = [
  {
    name: 'Architecture Analyzer',
    author: 'Recurrsive',
    description: 'Analyze system architecture, module coupling, dependency graphs, and structural patterns across your codebase.',
    icon: Boxes,
    category: 'Analyzers',
    downloads: '14.2k',
    rating: 4.9,
    source: 'Built-in',
    installed: true,
    color: 'var(--purple)',
  },
  {
    name: 'Performance Analyzer',
    author: 'Recurrsive',
    description: 'Detect bottlenecks, N+1 queries, memory leaks, and compute inefficiencies with runtime-aware analysis.',
    icon: Gauge,
    category: 'Analyzers',
    downloads: '13.8k',
    rating: 4.8,
    source: 'Built-in',
    installed: true,
    color: 'var(--blue)',
  },
  {
    name: 'Security Analyzer',
    author: 'Recurrsive',
    description: 'Scan for OWASP Top 10, CVEs, secret leaks, insecure configurations, and supply chain vulnerabilities.',
    icon: ShieldCheck,
    category: 'Analyzers',
    downloads: '15.1k',
    rating: 4.9,
    source: 'Built-in',
    installed: true,
    color: 'var(--red)',
  },
  {
    name: 'Cost Analyzer',
    author: 'Recurrsive',
    description: 'Track cloud spend, identify over-provisioned resources, and model cost-per-feature across infrastructure.',
    icon: DollarSign,
    category: 'Analyzers',
    downloads: '11.3k',
    rating: 4.7,
    source: 'Built-in',
    installed: true,
    color: 'var(--green)',
  },
  {
    name: 'Data Analyzer',
    author: 'Recurrsive',
    description: 'Audit data flows, schema evolution, PII exposure, and cross-service data lineage in real time.',
    icon: Database,
    category: 'Analyzers',
    downloads: '10.6k',
    rating: 4.6,
    source: 'Built-in',
    installed: true,
    color: 'var(--cyan)',
  },
  {
    name: 'Documentation Analyzer',
    author: 'Recurrsive',
    description: 'Evaluate documentation completeness, detect stale docs, and generate coverage reports per module.',
    icon: FileText,
    category: 'Analyzers',
    downloads: '9.4k',
    rating: 4.5,
    source: 'Built-in',
    installed: true,
    color: 'var(--amber)',
  },
  {
    name: 'DevOps Analyzer',
    author: 'Recurrsive',
    description: 'Analyze CI/CD pipelines, deployment frequency, DORA metrics, and infrastructure-as-code quality.',
    icon: GitBranch,
    category: 'Analyzers',
    downloads: '12.1k',
    rating: 4.8,
    source: 'Built-in',
    installed: true,
    color: '#f97316',
  },
  {
    name: 'API Contract Analyzer',
    author: 'Recurrsive',
    description: 'Validate OpenAPI specs, detect breaking changes, and ensure contract consistency across services.',
    icon: FileCode2,
    category: 'Analyzers',
    downloads: '10.9k',
    rating: 4.7,
    source: 'Built-in',
    installed: true,
    color: '#ec4899',
  },
  {
    name: 'Dependency Analyzer',
    author: 'Recurrsive',
    description: 'Map dependency trees, flag outdated packages, detect license conflicts, and track vulnerability exposure.',
    icon: Package,
    category: 'Analyzers',
    downloads: '13.2k',
    rating: 4.8,
    source: 'Built-in',
    installed: true,
    color: '#14b8a6',
  },
  {
    name: 'Code Quality Analyzer',
    author: 'Recurrsive',
    description: 'Measure complexity, duplication, test coverage, and maintainability index with actionable insights.',
    icon: Code2,
    category: 'Analyzers',
    downloads: '14.5k',
    rating: 4.9,
    source: 'Built-in',
    installed: true,
    color: '#8b5cf6',
  },
  {
    name: 'Reliability Analyzer',
    author: 'Recurrsive',
    description: 'Evaluate SLO compliance, error budgets, circuit breaker patterns, and fault tolerance across services.',
    icon: Activity,
    category: 'Analyzers',
    downloads: '11.7k',
    rating: 4.7,
    source: 'Built-in',
    installed: true,
    color: '#06b6d4',
  },
  {
    name: 'AI Runtime Analyzer',
    author: 'Recurrsive',
    description: 'Monitor LLM token usage, latency distributions, hallucination rates, and prompt chain performance.',
    icon: Brain,
    category: 'Analyzers',
    downloads: '8.9k',
    rating: 4.6,
    source: 'Built-in',
    installed: true,
    color: '#a855f7',
  },
  {
    name: 'AI Patterns Analyzer',
    author: 'Recurrsive',
    description: 'Detect RAG anti-patterns, evaluate agent orchestration, and audit AI safety guardrails in production.',
    icon: Cpu,
    category: 'Analyzers',
    downloads: '7.8k',
    rating: 4.5,
    source: 'Built-in',
    installed: true,
    color: '#e879f9',
  },
  {
    name: 'Kubernetes Analyzer',
    author: 'CloudForge Labs',
    description: 'Deep analysis of K8s clusters: resource quotas, pod scheduling efficiency, and network policy coverage.',
    icon: Container,
    category: 'Analyzers',
    downloads: '3.2k',
    rating: 4.4,
    source: 'Community',
    installed: false,
    color: '#3b82f6',
  },
  {
    name: 'Healthcare Compliance',
    author: 'AI Safety Labs',
    description: 'HIPAA, HITECH, and FDA 21 CFR Part 11 compliance checking for healthcare software systems.',
    icon: HeartPulse,
    category: 'Policies',
    downloads: '1.8k',
    rating: 4.3,
    source: 'Community',
    installed: false,
    color: '#ef4444',
  },
  {
    name: 'FinOps Optimizer',
    author: 'FinTech Assurance Group',
    description: 'Advanced cloud cost optimization with reserved instance recommendations and spot fleet strategies.',
    icon: TrendingUp,
    category: 'Intelligence Packs',
    downloads: '2.4k',
    rating: 4.5,
    source: 'Community',
    installed: false,
    color: '#22c55e',
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <Star size={13} style={{ color: 'var(--amber)', fill: 'var(--amber)' }} />
      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{rating}</span>
    </span>
  );
}

export default function MarketplacePage() {
  const [active, setActive] = useState<Category>('All');

  const filtered =
    active === 'All'
      ? EXTENSIONS
      : EXTENSIONS.filter((e) => e.category === active);

  const analyzerCount = EXTENSIONS.filter((e) => e.category === 'Analyzers').length;
  const categoryCount = new Set(EXTENSIONS.map((e) => e.category)).size;

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
        <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="badge badge-accent" style={{ marginBottom: 'var(--space-lg)' }}>
            <Store size={14} /> Marketplace
          </div>
          <h1 style={{ marginBottom: 'var(--space-md)' }}>
            Extend <span className="text-gradient">Recurrsive</span>
          </h1>
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              color: 'var(--text-secondary)',
              maxWidth: 600,
              margin: '0 auto var(--space-xl)',
              lineHeight: 1.7,
            }}
          >
            Browse analyzers, collectors, policies, and intelligence packs to tailor
            Recurrsive to your engineering organization.
          </p>

          {/* Stats */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 'var(--space-2xl)',
              marginBottom: 'var(--space-xl)',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <span
                className="text-gradient"
                style={{ fontSize: '1.8rem', fontWeight: 800 }}
              >
                {EXTENSIONS.length}
              </span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                Extensions Available
              </p>
            </div>
            <div>
              <span
                className="text-gradient"
                style={{ fontSize: '1.8rem', fontWeight: 800 }}
              >
                {categoryCount}
              </span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Categories</p>
            </div>
            <div>
              <span
                className="text-gradient"
                style={{ fontSize: '1.8rem', fontWeight: 800 }}
              >
                {analyzerCount}
              </span>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Analyzers</p>
            </div>
          </div>

          {/* Search Bar */}
          <div
            style={{
              maxWidth: 520,
              margin: '0 auto var(--space-xl)',
              position: 'relative',
            }}
          >
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
              }}
            />
            <input
              type="text"
              placeholder="Search extensions…"
              style={{
                width: '100%',
                padding: '14px 20px 14px 44px',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                backdropFilter: 'blur(10px)',
              }}
            />
          </div>

          {/* Filter Tabs */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 'var(--space-sm)',
              flexWrap: 'wrap',
            }}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid',
                  borderColor:
                    active === cat ? 'var(--border-accent)' : 'var(--border-subtle)',
                  background:
                    active === cat
                      ? 'rgba(124, 58, 237, 0.15)'
                      : 'var(--bg-glass)',
                  color:
                    active === cat ? 'var(--text-accent)' : 'var(--text-secondary)',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all var(--transition-fast)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Extension Grid */}
      <section className="section-sm">
        <div className="container-wide">
          <div className="grid-4">
            {filtered.map((ext) => (
              <div key={ext.name} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-md)',
                      background: `${ext.color}22`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${ext.color}33`,
                    }}
                  >
                    <ext.icon size={22} style={{ color: ext.color }} />
                  </div>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background:
                        ext.source === 'Built-in'
                          ? 'rgba(124, 58, 237, 0.12)'
                          : 'rgba(6, 182, 212, 0.12)',
                      color:
                        ext.source === 'Built-in'
                          ? 'var(--text-accent)'
                          : 'var(--cyan)',
                      border: `1px solid ${
                        ext.source === 'Built-in'
                          ? 'rgba(124, 58, 237, 0.2)'
                          : 'rgba(6, 182, 212, 0.2)'
                      }`,
                    }}
                  >
                    {ext.source}
                  </span>
                </div>

                {/* Title & Author */}
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>
                  {ext.name}
                </h4>
                <p
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-tertiary)',
                    marginBottom: 'var(--space-sm)',
                  }}
                >
                  by {ext.author}
                </p>

                {/* Description */}
                <p
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    flex: 1,
                    marginBottom: 'var(--space-md)',
                  }}
                >
                  {ext.description}
                </p>

                {/* Stats Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--space-md)',
                    paddingTop: 'var(--space-sm)',
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.82rem',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    <Download size={13} /> {ext.downloads}
                  </span>
                  <StarRating rating={ext.rating} />
                </div>

                {/* Install Button */}
                {ext.installed ? (
                  <button
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(34, 197, 94, 0.2)',
                      background: 'rgba(34, 197, 94, 0.1)',
                      color: '#4ade80',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'default',
                      fontFamily: 'var(--font-sans)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <CheckCircle2 size={15} /> Installed
                  </button>
                ) : (
                  <button className="btn btn-primary" style={{ width: '100%', padding: '10px' }}>
                    Install
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container" style={{ textAlign: 'center' }}>
          <div className="divider-gradient" style={{ marginBottom: 'var(--space-3xl)' }} />
          <h2 style={{ marginBottom: 'var(--space-md)' }}>
            Build Your Own <span className="text-gradient">Extensions</span>
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              maxWidth: 500,
              margin: '0 auto var(--space-xl)',
              fontSize: '1.05rem',
            }}
          >
            Use the Plugin SDK to create custom analyzers, collectors, and intelligence packs for your team.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/docs" className="btn btn-primary btn-lg">
              <Sparkles size={18} /> Plugin SDK Docs
            </Link>
            <Link href="/docs" className="btn btn-secondary btn-lg">
              View Examples <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        input::placeholder {
          color: var(--text-tertiary);
        }
        input:focus {
          border-color: var(--border-accent) !important;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
        }
      `}</style>
    </div>
  );
}
