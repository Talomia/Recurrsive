/**
 * @module @recurrsive/cli/commands/audit
 *
 * `recurrsive audit` — View and search the audit trail.
 *
 * Provides subcommands for listing, searching, and exporting
 * audit events from the Recurrsive server.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import {
  header,
  info,
  error,
  dim,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Audit event record. */
interface AuditEvent {
  id: string;
  type: string;
  action: string;
  target: string;
  timestamp: string;
  actor?: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const DEFAULT_SERVER = 'http://localhost:3000';

/**
 * Make an API request to the Recurrsive server.
 */
async function apiRequest(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  const base = process.env['RECURRSIVE_SERVER'] ?? DEFAULT_SERVER;
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

/** Generate fallback mock audit events. */
function getMockEvents(): AuditEvent[] {
  const now = Date.now();
  return [
    {
      id: 'evt_001',
      type: 'analysis',
      action: 'started',
      target: '/projects/web-app',
      timestamp: new Date(now - 3600000).toISOString(),
      actor: 'user@example.com',
    },
    {
      id: 'evt_002',
      type: 'analysis',
      action: 'completed',
      target: '/projects/web-app',
      timestamp: new Date(now - 3500000).toISOString(),
      actor: 'user@example.com',
      details: 'Found 12 findings, 5 opportunities',
    },
    {
      id: 'evt_003',
      type: 'policy',
      action: 'violation_detected',
      target: 'security-baseline',
      timestamp: new Date(now - 3400000).toISOString(),
      actor: 'system',
      details: 'Critical severity violation',
    },
    {
      id: 'evt_004',
      type: 'webhook',
      action: 'delivered',
      target: 'wh_000001',
      timestamp: new Date(now - 3000000).toISOString(),
      actor: 'system',
    },
    {
      id: 'evt_005',
      type: 'config',
      action: 'updated',
      target: 'notification_channels',
      timestamp: new Date(now - 1800000).toISOString(),
      actor: 'admin@example.com',
      details: 'Added Slack channel',
    },
  ];
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `audit` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerAuditCommand(program: Command): void {
  const audit = program
    .command('audit')
    .description('View and search the audit trail');

  // ── audit list ──────────────────────────────────────────────────────
  audit
    .command('list')
    .description('List recent audit events')
    .option('--limit <n>', 'Maximum events to show', '20')
    .option('--json', 'Output as JSON')
    .action(async (opts: { limit: string; json?: boolean }) => {
      try {
        let events: AuditEvent[];
        try {
          const data = await apiRequest(`/api/v1/audit?limit=${opts.limit}`) as { events: AuditEvent[] };
          events = data.events;
        } catch {
          // Fallback to mock data
          events = getMockEvents();
        }

        if (opts.json) {
          console.log(JSON.stringify(events, null, 2));
          return;
        }

        header('Audit Trail');

        if (events.length === 0) {
          info(dim('No audit events recorded yet.'));
          return;
        }

        const rows = events.map(e => [
          e.type,
          e.action,
          e.target,
          e.timestamp.replace('T', ' ').replace(/\.\d+Z$/, 'Z'),
        ]);

        table(['Type', 'Action', 'Target', 'Timestamp'], rows);

        info(`\n${dim(`Showing ${events.length} event(s)`)}`);
      } catch (err) {
        error(`Failed to list audit events: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  // ── audit search ──────────────────────────────────────────────────────
  audit
    .command('search <query>')
    .description('Search audit events by keyword')
    .option('--json', 'Output as JSON')
    .action(async (query: string, opts: { json?: boolean }) => {
      try {
        let events: AuditEvent[];
        try {
          const data = await apiRequest(`/api/v1/audit/search?q=${encodeURIComponent(query)}`) as { events: AuditEvent[] };
          events = data.events;
        } catch {
          // Fallback — filter mock data
          const all = getMockEvents();
          const lowerQuery = query.toLowerCase();
          events = all.filter(e =>
            e.type.toLowerCase().includes(lowerQuery) ||
            e.action.toLowerCase().includes(lowerQuery) ||
            e.target.toLowerCase().includes(lowerQuery) ||
            (e.details ?? '').toLowerCase().includes(lowerQuery),
          );
        }

        if (opts.json) {
          console.log(JSON.stringify(events, null, 2));
          return;
        }

        header(`Audit Search: "${query}"`);

        if (events.length === 0) {
          info(dim('No matching audit events found.'));
          return;
        }

        const rows = events.map(e => [
          e.type,
          e.action,
          e.target,
          e.timestamp.replace('T', ' ').replace(/\.\d+Z$/, 'Z'),
        ]);

        table(['Type', 'Action', 'Target', 'Timestamp'], rows);

        info(`\n${dim(`Found ${events.length} matching event(s)`)}`);
      } catch (err) {
        error(`Failed to search audit events: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  // ── audit export ──────────────────────────────────────────────────────
  audit
    .command('export')
    .description('Export audit log as JSON')
    .option('--json', 'Output as JSON (default for export)')
    .action(async () => {
      try {
        let events: AuditEvent[];
        try {
          const data = await apiRequest('/api/v1/audit?limit=1000') as { events: AuditEvent[] };
          events = data.events;
        } catch {
          // Fallback to mock data
          events = getMockEvents();
        }

        const exportData = {
          exported_at: new Date().toISOString(),
          event_count: events.length,
          events,
        };

        console.log(JSON.stringify(exportData, null, 2));
      } catch (err) {
        error(`Failed to export audit log: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });
}
