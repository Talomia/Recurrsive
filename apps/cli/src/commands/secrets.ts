/**
 * @module @recurrsive/cli/commands/secrets
 *
 * `recurrsive secrets` — Manage secrets and view audit logs.
 *
 * Values are never displayed. Rotation is performed by the server; the
 * CLI reports the real resulting version. Audit entries come from the
 * server's `/api/v1/secrets/audit/log` endpoint.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import { apiRequest, apiRequestList, reportApiError } from '../config.js';
import {
  header,
  info,
  success,
  bold,
  cyan,
  dim,
  green,
  red,
  magenta,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types (match the server's secret shapes)
// ---------------------------------------------------------------------------

interface SecretEntry {
  id: string;
  key: string;
  description: string;
  backend: string;
  version: number;
  tags: string[];
  lastRotated: string | null;
  rotationIntervalDays: number;
  expiresAt: string | null;
}

interface SecretAuditEntry {
  id: string;
  secretId: string;
  secretKey: string;
  action: 'created' | 'read' | 'updated' | 'rotated' | 'deleted';
  actor: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function actionBadge(action: string): string {
  switch (action) {
    case 'read':    return dim('READ');
    case 'rotated': return magenta('ROTATED');
    case 'created': return green('CREATED');
    case 'updated': return cyan('UPDATED');
    case 'deleted': return red('DELETED');
    default:        return dim(action.toUpperCase());
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
    .description('List all secrets (values are never shown)')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let items: SecretEntry[];
      let total: number;
      try {
        const res = await apiRequestList<SecretEntry>('/api/v1/secrets');
        items = res.items;
        total = res.total;
      } catch (err) {
        reportApiError(err, { action: 'List secrets' });
      }

      if (opts.json) {
        console.log(JSON.stringify(items, null, 2));
        return;
      }

      header('Secrets');

      if (items.length === 0) {
        info(dim('No secrets managed yet.'));
        return;
      }

      const rows = items.map((s) => [
        bold(s.key),
        cyan(s.backend),
        `v${s.version}`,
        dim(s.lastRotated ?? 'never'),
        s.rotationIntervalDays > 0 ? `${s.rotationIntervalDays}d` : dim('manual'),
      ]);
      console.log(table(['Key', 'Backend', 'Version', 'Last Rotated', 'Rotation'], rows));
      console.log('');
      info(dim(`${total} secret(s) managed · Values are never displayed`));
      console.log('');
    });

  // ── secrets rotate ───────────────────────────────────────────────────
  secrets
    .command('rotate <id>')
    .description('Trigger rotation for a secret (by its ID)')
    .action(async (id: string) => {
      header('Secret Rotation');

      let result: { secret: SecretEntry; message?: string };
      try {
        const env = (await apiRequest(`/api/v1/secrets/${encodeURIComponent(id)}/rotate`, {
          method: 'POST',
          body: JSON.stringify({}),
        })) as { data: SecretEntry; message?: string };
        result = { secret: env.data, message: env.message };
      } catch (err) {
        reportApiError(err, { resource: `secret '${id}'`, action: 'Rotate secret' });
      }

      info(`  ${bold('Key:')}         ${cyan(result.secret.key)}`);
      info(`  ${bold('New Version:')} ${green(`v${result.secret.version}`)}`);
      info(`  ${bold('Rotated At:')}  ${dim(result.secret.lastRotated ?? '')}`);
      console.log('');
      success(result.message ?? `Secret ${bold(result.secret.key)} rotated to v${result.secret.version}`);
      console.log('');
    });

  // ── secrets audit-log ────────────────────────────────────────────────
  secrets
    .command('audit-log')
    .description('Show recent access and rotation events')
    .option('--json', 'Output as JSON')
    .option('--limit <n>', 'Number of events to show', '10')
    .action(async (opts: { json?: boolean; limit?: string }) => {
      const limit = parseInt(opts.limit ?? '10', 10);
      let allEvents: SecretAuditEntry[];
      try {
        allEvents = (await apiRequestList<SecretAuditEntry>('/api/v1/secrets/audit/log')).items;
      } catch (err) {
        reportApiError(err, { action: 'Fetch secrets audit log' });
      }
      const events = allEvents.slice(0, limit);

      if (opts.json) {
        console.log(JSON.stringify(events, null, 2));
        return;
      }

      header('Secrets Audit Log');

      if (events.length === 0) {
        info(dim('No secret audit events recorded yet.'));
        return;
      }

      const rows = events.map((e) => [
        dim(e.timestamp.replace('T', ' ').replace(/\.\d+Z$/, 'Z')),
        bold(e.secretKey),
        actionBadge(e.action),
        cyan(e.actor),
      ]);
      console.log(table(['Timestamp', 'Key', 'Action', 'Actor'], rows));
      console.log('');
      info(dim(`Showing ${events.length} most recent event(s)`));
      console.log('');
    });
}
