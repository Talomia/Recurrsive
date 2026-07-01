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
// Mock Data
// ---------------------------------------------------------------------------

function getMockSecrets(): SecretEntry[] {
  return [
    { name: 'DATABASE_URL', backend: 'vault', version: 5, lastRotated: '2026-06-28', status: 'current' },
    { name: 'API_KEY_STRIPE', backend: 'aws-ssm', version: 3, lastRotated: '2026-06-15', status: 'expiring' },
    { name: 'JWT_SIGNING_KEY', backend: 'vault', version: 8, lastRotated: '2026-06-30', status: 'current' },
    { name: 'SMTP_PASSWORD', backend: 'azure-keyvault', version: 2, lastRotated: '2026-05-10', status: 'expired' },
    { name: 'REDIS_AUTH_TOKEN', backend: 'aws-ssm', version: 4, lastRotated: '2026-06-20', status: 'current' },
    { name: 'WEBHOOK_SECRET', backend: 'env', version: 1, lastRotated: '2026-04-01', status: 'expired' },
  ];
}

function getMockAuditLog(): AuditEvent[] {
  return [
    { timestamp: '2026-06-30 14:23:01', key: 'JWT_SIGNING_KEY', action: 'rotate', actor: 'ci-pipeline', sourceIp: '10.0.1.42' },
    { timestamp: '2026-06-30 12:15:33', key: 'DATABASE_URL', action: 'read', actor: 'api-gateway', sourceIp: '10.0.2.15' },
    { timestamp: '2026-06-29 18:44:12', key: 'API_KEY_STRIPE', action: 'read', actor: 'billing-svc', sourceIp: '10.0.3.8' },
    { timestamp: '2026-06-29 09:30:00', key: 'REDIS_AUTH_TOKEN', action: 'rotate', actor: 'admin@recurrsive.dev', sourceIp: '192.168.1.100' },
    { timestamp: '2026-06-28 22:10:45', key: 'DATABASE_URL', action: 'rotate', actor: 'ci-pipeline', sourceIp: '10.0.1.42' },
    { timestamp: '2026-06-28 16:05:22', key: 'JWT_SIGNING_KEY', action: 'read', actor: 'auth-service', sourceIp: '10.0.2.20' },
    { timestamp: '2026-06-27 11:33:18', key: 'WEBHOOK_SECRET', action: 'read', actor: 'webhook-handler', sourceIp: '10.0.4.5' },
    { timestamp: '2026-06-26 08:12:50', key: 'SMTP_PASSWORD', action: 'read', actor: 'notification-svc', sourceIp: '10.0.3.12' },
    { timestamp: '2026-06-25 15:48:30', key: 'API_KEY_STRIPE', action: 'create', actor: 'admin@recurrsive.dev', sourceIp: '192.168.1.100' },
    { timestamp: '2026-06-24 10:20:05', key: 'DATABASE_URL', action: 'read', actor: 'data-pipeline', sourceIp: '10.0.5.3' },
  ];
}

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
    .action((opts: { json?: boolean }) => {
      const data = getMockSecrets();

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
    .action((id: string) => {
      const secret = getMockSecrets().find((s) => s.name === id);
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
    .action((opts: { json?: boolean; limit?: string }) => {
      const limit = parseInt(opts.limit ?? '10', 10);
      const data = getMockAuditLog().slice(0, limit);

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
