/**
 * @module @recurrsive/cli/commands/audit
 *
 * `recurrsive audit` — View and filter the audit trail.
 *
 * Backed by the server's `GET /api/v1/audit` endpoint, which records
 * every authenticated request (method, path, status, actor, action
 * classification). There is no free-text search endpoint; the `filter`
 * subcommand uses the real query filters the server supports.
 *
 * @packageDocumentation
 */

import { apiRequestList, reportApiError } from '../config.js';
import type { Command } from 'commander';
import {
  header,
  info,
  dim,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types (match the server's audit event shape)
// ---------------------------------------------------------------------------

/** Audit event record as returned by the server. */
interface AuditEvent {
  id: string;
  timestamp: string;
  userId?: string;
  username?: string;
  role?: string;
  method: string;
  url: string;
  statusCode: number;
  action: string;
  resourceType?: string;
  resourceId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function eventRows(events: AuditEvent[]): string[][] {
  return events.map((e) => [
    (e.timestamp ?? '').replace('T', ' ').replace(/\.\d+Z$/, 'Z'),
    e.action ?? '',
    e.method ?? '',
    e.url ?? '',
    String(e.statusCode ?? ''),
    e.username ?? e.userId ?? dim('—'),
  ]);
}

const COLUMNS = ['Timestamp', 'Action', 'Method', 'Path', 'Status', 'Actor'];

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
    .description('View and filter the audit trail');

  // ── audit list ──────────────────────────────────────────────────────
  audit
    .command('list')
    .description('List recent audit events')
    .option('--limit <n>', 'Maximum events to show', '20')
    .option('--json', 'Output as JSON')
    .action(async (opts: { limit: string; json?: boolean }) => {
      let events: AuditEvent[];
      let total: number;
      try {
        const res = await apiRequestList<AuditEvent>(
          `/api/v1/audit?limit=${encodeURIComponent(opts.limit)}`,
        );
        events = res.items;
        total = res.total;
      } catch (err) {
        reportApiError(err, { action: 'List audit events' });
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

      console.log(table(COLUMNS, eventRows(events)));
      info(`\n${dim(`Showing ${events.length} of ${total} event(s)`)}`);
    });

  // ── audit filter ────────────────────────────────────────────────────
  // The server has no keyword search; it filters by structured fields.
  audit
    .command('filter')
    .description('Filter audit events by the fields the server supports')
    .option('--action <action>', 'read | write | delete | auth | admin')
    .option('--user <userId>', 'Filter by user ID')
    .option('--method <method>', 'HTTP method (GET, POST, …)')
    .option('--status <group>', 'Status group: 2xx, 3xx, 4xx, 5xx')
    .option('--from <iso>', 'Include events on or after this ISO timestamp')
    .option('--to <iso>', 'Include events on or before this ISO timestamp')
    .option('--limit <n>', 'Maximum events to show', '50')
    .option('--json', 'Output as JSON')
    .action(
      async (opts: {
        action?: string;
        user?: string;
        method?: string;
        status?: string;
        from?: string;
        to?: string;
        limit: string;
        json?: boolean;
      }) => {
        const params = new URLSearchParams();
        if (opts.action) params.set('action', opts.action);
        if (opts.user) params.set('userId', opts.user);
        if (opts.method) params.set('method', opts.method);
        if (opts.status) params.set('status', opts.status);
        if (opts.from) params.set('from', opts.from);
        if (opts.to) params.set('to', opts.to);
        params.set('limit', opts.limit);

        let events: AuditEvent[];
        let total: number;
        try {
          const res = await apiRequestList<AuditEvent>(
            `/api/v1/audit?${params.toString()}`,
          );
          events = res.items;
          total = res.total;
        } catch (err) {
          reportApiError(err, { action: 'Filter audit events' });
        }

        if (opts.json) {
          console.log(JSON.stringify(events, null, 2));
          return;
        }

        header('Audit Trail (filtered)');

        if (events.length === 0) {
          info(dim('No matching audit events found.'));
          return;
        }

        console.log(table(COLUMNS, eventRows(events)));
        info(`\n${dim(`Showing ${events.length} of ${total} matching event(s)`)}`);
      },
    );

  // ── audit export ────────────────────────────────────────────────────
  audit
    .command('export')
    .description('Export the audit log as JSON')
    .action(async () => {
      let events: AuditEvent[];
      try {
        events = (await apiRequestList<AuditEvent>('/api/v1/audit?limit=1000')).items;
      } catch (err) {
        reportApiError(err, { action: 'Export audit log' });
      }

      const exportData = {
        exported_at: new Date().toISOString(),
        event_count: events.length,
        events,
      };

      console.log(JSON.stringify(exportData, null, 2));
    });
}
