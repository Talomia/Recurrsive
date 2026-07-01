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
// Mock Data
// ---------------------------------------------------------------------------

function getMockBenchmarks(): BenchmarkEntry[] {
  return [
    { metric: 'Code Quality', yourScore: 82, industryAvg: 68, percentile: 78 },
    { metric: 'Test Coverage', yourScore: 71, industryAvg: 62, percentile: 65 },
    { metric: 'Deploy Frequency', yourScore: 88, industryAvg: 55, percentile: 91 },
    { metric: 'MTTR', yourScore: 76, industryAvg: 60, percentile: 72 },
    { metric: 'Security Score', yourScore: 90, industryAvg: 70, percentile: 85 },
    { metric: 'Documentation', yourScore: 58, industryAvg: 45, percentile: 68 },
  ];
}

function getMockPatterns(): PatternEntry[] {
  return [
    { name: 'Event-driven microservices', category: 'architecture', adoptionRate: 67, impact: 'High', source: '1,240 orgs' },
    { name: 'Contract testing for APIs', category: 'testing', adoptionRate: 45, impact: 'High', source: '890 orgs' },
    { name: 'Zero-trust service mesh', category: 'security', adoptionRate: 38, impact: 'Critical', source: '720 orgs' },
    { name: 'Progressive delivery (canary)', category: 'devops', adoptionRate: 52, impact: 'Medium', source: '1,100 orgs' },
    { name: 'Database query optimization', category: 'performance', adoptionRate: 71, impact: 'High', source: '1,500 orgs' },
    { name: 'Feature flag lifecycle mgmt', category: 'devops', adoptionRate: 43, impact: 'Medium', source: '680 orgs' },
    { name: 'Automated threat modeling', category: 'security', adoptionRate: 28, impact: 'High', source: '450 orgs' },
    { name: 'Observability-driven development', category: 'performance', adoptionRate: 35, impact: 'Medium', source: '560 orgs' },
  ];
}

function getMockPartners(): PartnerEntry[] {
  return [
    { name: 'CloudForge Solutions', tier: 'Platinum', specialty: 'Cloud Migration', region: 'North America', status: 'active' },
    { name: 'SecureStack GmbH', tier: 'Platinum', specialty: 'Security Auditing', region: 'Europe', status: 'active' },
    { name: 'DataFlow Analytics', tier: 'Gold', specialty: 'Data Engineering', region: 'North America', status: 'active' },
    { name: 'DevOps Accelerate', tier: 'Gold', specialty: 'CI/CD Optimization', region: 'Asia-Pacific', status: 'active' },
    { name: 'QualityFirst Labs', tier: 'Silver', specialty: 'Test Automation', region: 'Europe', status: 'active' },
    { name: 'InfraScale Partners', tier: 'Silver', specialty: 'Infrastructure', region: 'South America', status: 'pending' },
  ];
}

function getMockServiceStatus(): ServiceStatus[] {
  return [
    { service: 'Analysis Engine', status: 'operational', uptime: '99.98%', latency: '45ms', region: 'us-east-1' },
    { service: 'Graph Database', status: 'operational', uptime: '99.95%', latency: '12ms', region: 'us-east-1' },
    { service: 'API Gateway', status: 'operational', uptime: '99.99%', latency: '8ms', region: 'global' },
    { service: 'Webhook Delivery', status: 'degraded', uptime: '99.82%', latency: '320ms', region: 'eu-west-1' },
    { service: 'Dashboard', status: 'operational', uptime: '99.97%', latency: '65ms', region: 'global' },
    { service: 'Plugin Registry', status: 'operational', uptime: '99.94%', latency: '38ms', region: 'us-west-2' },
    { service: 'Snapshot Storage', status: 'operational', uptime: '99.99%', latency: '22ms', region: 'us-east-1' },
  ];
}

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
    .action((opts: { json?: boolean }) => {
      const data = getMockBenchmarks();

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
    .action((opts: { json?: boolean }) => {
      const data = getMockPatterns();

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
    .action((opts: { json?: boolean }) => {
      const data = getMockPartners();

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
    .action((opts: { json?: boolean }) => {
      const data = getMockServiceStatus();

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
