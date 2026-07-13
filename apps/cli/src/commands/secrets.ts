/**
 * @module @recurrsive/cli/commands/secrets
 *
 * `recurrsive secrets` — Manage secrets and view audit logs.
 *
 * Provides subcommands for listing secrets (values always masked),
 * triggering rotation, and viewing access/rotation audit events.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import { apiRequest } from '../config.js';
import {
  header,
  info,
  success,
  bold,
  cyan,
  dim,
  green,
  yellow,
  red,
  magenta,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SecretEntry {
  id: string;
  key: string;
  description: string;
  backend: string;
  version: number;
  lastRotated: string | null;
  rotationIntervalDays: number;
  expiresAt: string | null;
}

interface AuditEvent {
  timestamp: string;
  secretKey: string;
  action: string;
  actor: string;
  metadata: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function actionBadge(action: string): string {
  switch (action) {
    case 'read':   return dim('READ');
    case 'rotated': return magenta('ROTATED');
    case 'created': return green('CREATED');
    case 'deleted': return red('DELETED');
    default:       return dim(action.toUpperCase());
  }
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `secrets` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerSecretsCommand(program: Command): void {
  const secrets = program
    .command('secrets')
    .description('Manage secrets and view audit logs');

  // ── secrets list ─────────────────────────────────────────────────────
  secrets
    .command('list')
    .description('List all secrets (values never shown)')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let data: SecretEntry[];
      try {
        data = await apiRequest<SecretEntry[]>('/api/v1/secrets');
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }

      if (opts.json) {
        const safe = data.map((s) => ({ ...s, value: '••••••••' }));
        console.log(JSON.stringify(safe, null, 2));
        return;
      }

      header('Secrets');

      const rows = data.map((s) => [
        bold(s.key),
        cyan(s.backend),
        `v${s.version}`,
        dim(s.lastRotated ?? 'Never'),
        s.rotationIntervalDays > 0 ? `${s.rotationIntervalDays} days` : 'Manual',
      ]);

      console.log(table(['Key Name', 'Backend', 'Version', 'Last Rotated', 'Rotation'], rows));
      console.log('');
      info(dim(`${data.length} secrets managed · Values are never displayed`));
      console.log('');
    });

  // ── secrets rotate ───────────────────────────────────────────────────
  secrets
    .command('rotate <id>')
    .description('Trigger secret rotation')
    .option('--new-value <value>', 'Replacement value (or set RECURRSIVE_SECRET_VALUE)')
    .action(async (id: string, opts: { newValue?: string }) => {
      const newValue = opts.newValue ?? process.env['RECURRSIVE_SECRET_VALUE'];
      if (!newValue) {
        console.error(yellow('A replacement value is required. Pass --new-value or set RECURRSIVE_SECRET_VALUE.'));
        process.exitCode = 1;
        return;
      }

      try {
        const rotated = await apiRequest<SecretEntry>(
          `/api/v1/secrets/${encodeURIComponent(id)}/rotate`,
          { method: 'POST', body: JSON.stringify({ newValue }) },
        );
        header('Secret Rotation');
        info(`  ${bold('Key:')}          ${cyan(rotated.key)}`);
        info(`  ${bold('New Version:')}  ${green(`v${rotated.version}`)}`);
        info(`  ${bold('Timestamp:')}    ${dim(rotated.lastRotated ?? new Date().toISOString())}`);
        console.log('');
        success(`Secret ${bold(rotated.key)} rotated to v${rotated.version}`);
        console.log('');
      } catch (caught) {
        console.error(yellow(`Failed to rotate secret: ${caught instanceof Error ? caught.message : String(caught)}`));
        process.exitCode = 1;
      }
    });

  // ── secrets audit-log ────────────────────────────────────────────────
  secrets
    .command('audit-log')
    .description('Show recent access and rotation events')
    .option('--json', 'Output as JSON')
    .option('--limit <n>', 'Number of events to show', '10')
    .action(async (opts: { json?: boolean; limit?: string }) => {
      const limit = parseInt(opts.limit ?? '10', 10);
      let allData: AuditEvent[];
      try {
        allData = await apiRequest<AuditEvent[]>('/api/v1/secrets/audit/log');
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }
      const data = allData.slice(0, limit);

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      header('Audit Log');

      const rows = data.map((e) => [
        dim(e.timestamp),
        bold(e.secretKey),
        actionBadge(e.action),
        cyan(e.actor),
        dim(JSON.stringify(e.metadata)),
      ]);

      console.log(table(['Timestamp', 'Key', 'Action', 'Actor', 'Metadata'], rows));
      console.log('');
      info(dim(`Showing ${data.length} most recent events`));
      console.log('');
    });
}
