'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CloudCog, ExternalLink, Loader2, Server } from 'lucide-react';
import Header from '@/components/header';
import { getCloudServices, type CloudServiceTier } from '@/lib/api';

export default function DeploymentPage() {
  const [services, setServices] = useState<CloudServiceTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCloudServices()
      .then(setServices)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load deployment information.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 px-4 pb-6 sm:px-6 lg:p-6">
      <Header title="Self-Hosted Deployment" subtitle="Operate Recurrsive in infrastructure controlled by your organization" />

      <div className="glass-card rounded-2xl p-5 flex items-start gap-4">
        <Server className="h-6 w-6 text-blue-400 shrink-0" />
        <div>
          <h2 className="font-semibold text-text-primary">This is not a managed SaaS control plane</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Availability, backups, scaling, and data residency are controlled by this deployment&apos;s operators.
            The Deployment &amp; Project Health page reports what this instance can directly measure.
          </p>
          <Link href="/health" className="mt-3 inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300">
            Open deployment health <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-blue-400" /></div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {services.map((service) => (
            <article key={service.id} className="glass-card rounded-2xl p-5">
              <CloudCog className="h-5 w-5 text-blue-400" />
              <h2 className="mt-3 text-lg font-semibold text-text-primary">{service.name}</h2>
              <p className="mt-1 text-sm text-text-secondary">{service.description}</p>
              <p className="mt-4 text-xl font-bold text-text-primary">{service.priceRange}</p>
              <p className="mt-1 text-xs text-text-muted">{service.availability}</p>
              <ul className="mt-4 space-y-2">
                {service.features.map((feature) => <li key={feature} className="text-sm text-text-secondary">• {feature}</li>)}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
