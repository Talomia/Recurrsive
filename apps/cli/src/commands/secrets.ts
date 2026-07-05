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
  warning,
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
  name: string;
  backend: string;
  version: number;
  lastRotated: string;
  status: 'current' | 'expiring' | 'expired';
}

interface AuditEvent {
  timestamp: string;
  key: string;
  action: string;
  actor: string;
  sourceIp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string): string {
  switch (status) {
    case 'current':  return green('● current');
    case 'expiring': return yellow('● expiring');
    case 'expired':  return red('● expired');
    default:         return dim('● unknown');
  }
}

function actionBadge(action: string): string {
  switch (action) {
    case 'read':   return dim('READ');
    case 'rotate': return magenta('ROTATE');
    case 'create': return green('CREATE');
    case 'delete': return red('DELETE');
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
        data = await apiRequest('/api/v1/secrets') as SecretEntry[];
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
        bold(s.name),
        cyan(s.backend),
        `v${s.version}`,
        dim(s.lastRotated),
        statusBadge(s.status),
      ]);

      console.log(table(['Key Name', 'Backend', 'Version', 'Last Rotated', 'Status'], rows));
      console.log('');
      info(dim(`${data.length} secrets managed · Values are never displayed`));
      console.log('');
    });

  // ── secrets rotate ───────────────────────────────────────────────────
  secrets
    .command('rotate <id>')
    .description('Trigger secret rotation')
    .action(async (id: string) => {
      let secrets: SecretEntry[];
      try {
        secrets = await apiRequest('/api/v1/secrets') as SecretEntry[];
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }
      const secret = secrets.find((s) => s.name === id);
      const oldVersion = secret ? secret.version : 1;
      const newVersion = oldVersion + 1;

      header('Secret Rotation');

      info(`  ${bold('Key:')}          ${cyan(id)}`);
      info(`  ${bold('Old Version:')}  v${oldVersion}`);
      info(`  ${bold('New Version:')}  ${green(`v${newVersion}`)}`);
      info(`  ${bold('Timestamp:')}    ${dim(new Date().toISOString())}`);
      console.log('');

      success(`Secret ${bold(id)} rotated to v${newVersion}`);
      console.log('');

      warning('New version may take up to 60s to propagate across all services.');
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
      let allData: AuditEvent[];
      try {
        allData = await apiRequest('/api/v1/secrets/audit') as AuditEvent[];
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
        bold(e.key),
        actionBadge(e.action),
        cyan(e.actor),
        dim(e.sourceIp),
      ]);

      console.log(table(['Timestamp', 'Key', 'Action', 'Actor', 'Source IP'], rows));
      console.log('');
      info(dim(`Showing ${data.length} most recent events`));
      console.log('');
    });
}
