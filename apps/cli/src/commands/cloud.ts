/**
 * @module @recurrsive/cli/commands/cloud
 *
 * `recurrsive cloud` — Cloud platform insights.
 *
 * Subcommands view industry benchmarks, cross-org learned patterns, the
 * partner directory, and the managed-services catalog. All data comes
 * from the server; the CLI does not fabricate uptime, latency, or scores.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import { apiRequest, apiRequestList, reportApiError } from '../config.js';
import {
  header,
  info,
  bold,
  cyan,
  dim,
  yellow,
  magenta,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types (match the server response shapes)
// ---------------------------------------------------------------------------

interface BenchmarkReport {
  industry: string;
  sampleSize: number;
  percentiles: { p25: number; p50: number; p75: number; p90: number };
  dimensionAverages: Record<string, number>;
  topImprovementAreas: string[];
}

interface LearnedPattern {
  id: string;
  name: string;
  category: string;
  occurrences: number;
  successRate: number;
  avgImpact: number;
  recommendation: string;
  confidence: number;
}

interface Partner {
  id: string;
  name: string;
  tier: 'platinum' | 'gold' | 'silver';
  type: string;
  specializations: string[];
  regions: string[];
  certifiedEngineers: number;
  customerCount: number;
}

interface ManagedService {
  id: string;
  name: string;
  description: string;
  tier: string;
  features: string[];
  priceRange: string;
  sla: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tierBadge(tier: string): string {
  switch (tier) {
    case 'platinum': return magenta('◆ Platinum');
    case 'gold':     return cyan('◆ Gold');
    case 'silver':   return yellow('◆ Silver');
    default:         return dim(`◆ ${tier}`);
  }
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `cloud` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerCloudCommand(program: Command): void {
  const cloud = program
    .command('cloud')
    .description('Cloud platform insights (benchmarks, patterns, partners, services)');

  // ── cloud benchmarks ─────────────────────────────────────────────────
  cloud
    .command('benchmarks')
    .description('Show the aggregated industry benchmark report')
    .option('--industry <name>', 'Filter to a specific industry')
    .option('--json', 'Output as JSON')
    .action(async (opts: { industry?: string; json?: boolean }) => {
      const qs = opts.industry ? `?industry=${encodeURIComponent(opts.industry)}` : '';
      let data: BenchmarkReport | { message: string; sampleSize: number };
      try {
        data = await apiRequest(`/api/v1/cloud/benchmarks/report${qs}`).then(
          (env) => (env as { data: BenchmarkReport | { message: string; sampleSize: number } }).data,
        );
      } catch (err) {
        reportApiError(err, { action: 'Fetch benchmark report' });
      }

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      header('Industry Benchmarks');

      if (!('percentiles' in data) || data.sampleSize === 0) {
        info(dim('No benchmark data available yet. Submit anonymized benchmarks to build the dataset.'));
        console.log('');
        return;
      }

      console.log(`  ${bold('Industry:')}    ${cyan(data.industry)}`);
      console.log(`  ${bold('Sample size:')} ${cyan(String(data.sampleSize))}`);
      console.log('');
      console.log(
        `  ${bold('Percentiles:')}  p25 ${data.percentiles.p25} · p50 ${data.percentiles.p50} · ` +
          `p75 ${data.percentiles.p75} · p90 ${data.percentiles.p90}`,
      );
      console.log('');

      const rows = Object.entries(data.dimensionAverages).map(([dim_, avg]) => [
        bold(dim_),
        String(avg),
      ]);
      if (rows.length > 0) {
        console.log(table(['Dimension', 'Average'], rows));
        console.log('');
      }
      if (data.topImprovementAreas.length > 0) {
        info(`Top improvement areas: ${data.topImprovementAreas.join(', ')}`);
        console.log('');
      }
    });

  // ── cloud patterns ───────────────────────────────────────────────────
  cloud
    .command('patterns')
    .description('View cross-organization learned patterns')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let patterns: LearnedPattern[];
      let total: number;
      try {
        const res = await apiRequestList<LearnedPattern>('/api/v1/cloud/patterns');
        patterns = res.items;
        total = res.total;
      } catch (err) {
        reportApiError(err, { action: 'Fetch learned patterns' });
      }

      if (opts.json) {
        console.log(JSON.stringify(patterns, null, 2));
        return;
      }

      header('Cross-Org Learned Patterns');

      if (patterns.length === 0) {
        info(dim('No patterns learned yet. Patterns emerge from aggregated, anonymized analysis data.'));
        console.log('');
        return;
      }

      const rows = patterns.map((p) => [
        bold(p.name),
        cyan(p.category),
        String(p.occurrences),
        `${Math.round(p.successRate * 100)}%`,
        `+${p.avgImpact}`,
      ]);
      console.log(table(['Pattern', 'Category', 'Occurrences', 'Success', 'Avg Impact'], rows));
      console.log('');
      info(dim(`${total} pattern(s) aggregated from anonymized cross-org data`));
      console.log('');
    });

  // ── cloud partners ───────────────────────────────────────────────────
  cloud
    .command('partners')
    .description('View the partner directory')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let partners: Partner[];
      let total: number;
      try {
        const res = await apiRequestList<Partner>('/api/v1/partners');
        partners = res.items;
        total = res.total;
      } catch (err) {
        reportApiError(err, { action: 'Fetch partners' });
      }

      if (opts.json) {
        console.log(JSON.stringify(partners, null, 2));
        return;
      }

      header('Partner Directory');

      if (partners.length === 0) {
        info(dim('No partners registered yet.'));
        console.log('');
        return;
      }

      const rows = partners.map((p) => [
        bold(p.name),
        tierBadge(p.tier),
        p.type,
        (p.specializations ?? []).join(', '),
        (p.regions ?? []).join(', '),
      ]);
      console.log(table(['Name', 'Tier', 'Type', 'Specializations', 'Regions'], rows));
      console.log('');
      info(dim(`${total} partner(s)`));
      console.log('');
    });

  // ── cloud services ───────────────────────────────────────────────────
  cloud
    .command('services')
    .description('View the managed-services catalog')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let services: ManagedService[];
      try {
        services = (await apiRequestList<ManagedService>('/api/v1/cloud/services')).items;
      } catch (err) {
        reportApiError(err, { action: 'Fetch managed services' });
      }

      if (opts.json) {
        console.log(JSON.stringify(services, null, 2));
        return;
      }

      header('Managed Services');

      if (services.length === 0) {
        info(dim('No managed services available.'));
        console.log('');
        return;
      }

      const rows = services.map((s) => [
        bold(s.name),
        cyan(s.tier),
        s.priceRange,
        s.sla,
      ]);
      console.log(table(['Service', 'Tier', 'Price', 'SLA'], rows));
      console.log('');
    });
}
