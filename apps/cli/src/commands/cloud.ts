/**
 * @module @recurrsive/cli/commands/cloud
 *
 * `recurrsive cloud` — Cloud platform insights and status.
 *
 * Provides subcommands for viewing industry benchmarks, cross-org
 * learned patterns, the partner directory, and platform status.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import { apiRequest } from '../config.js';
import {
  header,
  info,
  bold,
  cyan,
  dim,
  green,
  yellow,
  red,
  magenta,
  progressBar,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BenchmarkEntry {
  metric: string;
  yourScore: number;
  industryAvg: number;
  percentile: number;
}

interface PatternEntry {
  name: string;
  category: string;
  adoptionRate: number;
  impact: string;
  source: string;
}

interface PartnerEntry {
  name: string;
  tier: 'Platinum' | 'Gold' | 'Silver';
  specialty: string;
  region: string;
  status: string;
}

interface ServiceStatus {
  service: string;
  status: 'operational' | 'degraded' | 'outage';
  uptime: string;
  latency: string;
  region: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tierBadge(tier: string): string {
  switch (tier) {
    case 'Platinum': return magenta('◆ Platinum');
    case 'Gold':     return cyan('◆ Gold');
    case 'Silver':   return yellow('◆ Silver');
    default:         return dim(`◆ ${tier}`);
  }
}

function serviceStatusBadge(status: string): string {
  switch (status) {
    case 'operational': return green('● operational');
    case 'degraded':    return yellow('● degraded');
    case 'outage':      return red('● outage');
    default:            return dim('● unknown');
  }
}

function impactBadge(impact: string): string {
  switch (impact) {
    case 'Critical': return red(impact);
    case 'High':     return yellow(impact);
    case 'Medium':   return cyan(impact);
    case 'Low':      return dim(impact);
    default:         return dim(impact);
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
    .description('Cloud platform insights and status');

  // ── cloud benchmarks ─────────────────────────────────────────────────
  cloud
    .command('benchmarks')
    .description('Show industry benchmarks and percentiles')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let data: BenchmarkEntry[];
      try {
        data = await apiRequest('/api/v1/cloud/benchmarks') as BenchmarkEntry[];
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      header('Industry Benchmarks');

      const rows = data.map((b) => [
        bold(b.metric),
        cyan(String(b.yourScore)),
        dim(String(b.industryAvg)),
        progressBar(b.percentile, 100, 15),
      ]);

      console.log(table(['Metric', 'Your Score', 'Industry Avg', 'Percentile'], rows));
      console.log('');

      const avgPercentile = Math.round(data.reduce((s, b) => s + b.percentile, 0) / data.length);
      info(`  ${bold('Overall Ranking:')} Top ${100 - avgPercentile}% ${dim(`(${avgPercentile}th percentile)`)}`);
      console.log('');
    });

  // ── cloud patterns ───────────────────────────────────────────────────
  cloud
    .command('patterns')
    .description('View cross-organization learned patterns')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let data: PatternEntry[];
      try {
        data = await apiRequest('/api/v1/cloud/patterns') as PatternEntry[];
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      header('Cross-Org Learned Patterns');

      const rows = data.map((p) => [
        bold(p.name),
        cyan(p.category),
        `${p.adoptionRate}%`,
        impactBadge(p.impact),
        dim(p.source),
      ]);

      console.log(table(['Pattern', 'Category', 'Adoption', 'Impact', 'Source'], rows));
      console.log('');
      info(dim(`${data.length} patterns aggregated from anonymized cross-org data`));
      console.log('');
    });

  // ── cloud partners ───────────────────────────────────────────────────
  cloud
    .command('partners')
    .description('View the partner directory')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let data: PartnerEntry[];
      try {
        data = await apiRequest('/api/v1/marketplace/partners') as PartnerEntry[];
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      header('Partner Directory');

      const rows = data.map((p) => [
        bold(p.name),
        tierBadge(p.tier),
        p.specialty,
        dim(p.region),
        p.status === 'active' ? green(p.status) : yellow(p.status),
      ]);

      console.log(table(['Name', 'Tier', 'Specialty', 'Region', 'Status'], rows));
      console.log('');
      info(dim(`${data.length} certified partners`));
      console.log('');
    });

  // ── cloud status ─────────────────────────────────────────────────────
  cloud
    .command('status')
    .description('Show cloud platform status')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let data: ServiceStatus[];
      try {
        data = await apiRequest('/api/v1/cloud/status') as ServiceStatus[];
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      header('Platform Status');

      const operational = data.filter((s) => s.status === 'operational').length;
      const total = data.length;
      const healthPct = Math.round((operational / total) * 100);

      console.log(`  ${bold('Platform Health:')}`);
      console.log(`    ${progressBar(healthPct, 100, 35)}`);
      console.log(`    ${green(String(operational))}/${total} services operational`);
      console.log('');

      const rows = data.map((s) => [
        bold(s.service),
        serviceStatusBadge(s.status),
        s.uptime,
        cyan(s.latency),
        dim(s.region),
      ]);

      console.log(table(['Service', 'Status', 'Uptime', 'Latency', 'Region'], rows));
      console.log('');

      info(dim(`Last updated: ${new Date().toISOString()}`));
      console.log('');
    });
}
