'use client';
/**
 * Partners page.
 *
 * Partner directory with tier badges, certification tracks, stats, and apply CTA.
 */

import { useState, useEffect } from 'react';
import { Users, Award, Shield } from 'lucide-react';
import { getPartners, getPartnerCertifications, getPartnerStats } from '@/lib/api/platform';
import Header from '@/components/header';
import LoadingSkeleton from '@/components/loading-skeleton';

interface Partner {
  id: string;
  name: string;
  tier: 'platinum' | 'gold' | 'silver';
  specialty: string;
  logo: string;
  projects: number;
  description: string;
}

interface Certification {
  id: string;
  name: string;
  level: string;
  duration: string;
  modules: number;
  enrolled: number;
}

interface PartnerStats {
  totalPartners: number;
  totalCertifiedEngineers: number;
  totalCustomersServed: number;
  certificationTracks: number;
  pendingApplications: number;
  tierDistribution: Record<string, number>;
}

function TierBadge({ tier }: { tier: string }) {
  const c: Record<string, string> = {
    platinum: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    gold: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    silver: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${c[tier] ?? ''}`}>
      {tier}
    </span>
  );
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [pRes, certRes, stRes] = await Promise.all([
          getPartners(),
          getPartnerCertifications(),
          getPartnerStats(),
        ]);
        setPartners((pRes.data ?? []) as Partner[]);
        setCertifications((certRes.data ?? []) as Certification[]);
        setStats((stRes.data ?? null) as PartnerStats | null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load partner data');
      }
    }
    load().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Partner Program" subtitle="Explore our partner ecosystem, certification tracks, and collaboration opportunities" />
        <LoadingSkeleton variant="card" count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Header title="Partner Program" subtitle="Explore our partner ecosystem, certification tracks, and collaboration opportunities" />

      {/* Error banner */}
      {error && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3 text-sm text-red-400"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-3 hover:opacity-80">✕</button>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Partners', value: stats.totalPartners ?? 0 },
            { label: 'Certified', value: stats.totalCertifiedEngineers ?? 0 },
            { label: 'Projects Served', value: (stats.totalCustomersServed ?? 0).toLocaleString() },
            { label: 'Cert Tracks', value: stats.certificationTracks ?? 0 },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl p-4 text-center"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-2xl font-bold text-text-primary">{s.value}</p>
              <p className="text-xs text-text-tertiary mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Partner Directory */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
          Partner Directory
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="rounded-xl p-5"
              style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{partner.logo}</span>
                <div>
                  <h4 className="text-text-primary font-semibold">{partner.name}</h4>
                  <TierBadge tier={partner.tier} />
                </div>
              </div>
              <p className="text-sm text-text-secondary mb-2">{partner.description}</p>
              <div className="flex items-center justify-between text-xs text-text-tertiary">
                <span>{partner.specialty}</span>
                <span>{partner.projects} projects</span>
              </div>
            </div>
          ))}
        </div>
        {partners.length === 0 && !error && (
          <p className="text-sm text-text-tertiary text-center py-8">
            No partners found. Check back soon.
          </p>
        )}
      </div>

      {/* Certification Tracks */}
      {certifications.length > 0 && (
        <div
          className="rounded-2xl p-5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Award className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
            Certification Tracks
          </h3>
          <div className="space-y-3">
            {certifications.map((cert) => (
              <div
                key={cert.id}
                className="flex items-center justify-between rounded-xl p-4"
                style={{ background: 'var(--color-base)', border: '1px solid var(--color-border)' }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{cert.name}</span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
                      {cert.level}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {cert.modules} modules · {cert.duration} · {cert.enrolled} enrolled
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Apply CTA */}
      <div
        className="rounded-2xl p-6"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))',
          border: '1px solid rgba(139,92,246,0.25)',
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <Shield className="w-6 h-6 text-purple-400" />
          <h3 className="text-lg font-semibold text-text-primary">Become a Partner</h3>
        </div>
        <p className="text-sm text-text-secondary">
          Join the Recurrsive partner program to unlock co-selling opportunities, early access to new
          features, dedicated support, and certification programs for your team. Contact your Recurrsive
          account team to start an application.
        </p>
      </div>
    </div>
  );
}
