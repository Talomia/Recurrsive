/**
 * @module @recurrsive/cli/commands/export
 *
 * `recurrsive export` — Export analysis data in various formats.
 *
 * Provides subcommands for creating data exports and viewing export history
 * from the Recurrsive server.
 *
 * @packageDocumentation
 */

import { apiRequest } from '../config.js';
import type { Command } from 'commander';
import {
  header,
  info,
  error,
  dim,
  table,
  bold,
  cyan,
  green,
  yellow,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Export creation response. */
interface ExportResult {
  export_id: string;
  format: string;
  scope: string;
  status: string;
  download_url: string;
  record_count: number;
  generated_at: string;
}

/** Export history entry. */
interface ExportHistoryItem {
  export_id: string;
  format: string;
  scope: string;
  status: string;
  record_count: number;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `export` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerExportCommand(program: Command): void {
  const exp = program
    .command('export')
    .description('Export analysis data in various formats');

  // ── export create ──────────────────────────────────────────────────────
  exp
    .command('create <scope>')
    .description('Create a new data export')
    .option('--format <format>', 'Export format: json, csv, or markdown', 'json')
    .option('--json', 'Output as JSON')
    .action(async (scope: string, opts: { format?: string; json?: boolean }) => {
      try {
        const format = opts.format ?? 'json';
        let result: ExportResult;
        try {
          result = await apiRequest('/api/v1/export', {
            method: 'POST',
            body: JSON.stringify({ format, scope }),
          }) as ExportResult;
        } catch {
          console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        header('Export Created');

        info(`  ${bold('Export ID:')}    ${cyan(result.export_id)}`);
        info(`  ${bold('Format:')}      ${cyan(result.format)}`);
        info(`  ${bold('Scope:')}       ${cyan(result.scope)}`);
        info(`  ${bold('Status:')}      ${green(result.status)}`);
        info(`  ${bold('Records:')}     ${cyan(String(result.record_count))}`);
        info(`  ${bold('Download:')}    ${dim(result.download_url)}`);
        info(`  ${bold('Generated:')}   ${dim(result.generated_at)}`);
      } catch (err) {
        error(`Failed to create export: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  // ── export history ─────────────────────────────────────────────────────
  exp
    .command('history')
    .description('View past exports')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        let items: ExportHistoryItem[];
        try {
          const data = await apiRequest('/api/v1/export/history') as { data: ExportHistoryItem[] };
          items = data.data;
        } catch {
          console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(items, null, 2));
          return;
        }

        header('Export History');

        if (items.length === 0) {
          info(dim('No exports found.'));
          return;
        }

        const rows = items.map(item => [
          item.export_id,
          item.format,
          item.scope,
          item.status,
          String(item.record_count),
          item.generated_at,
        ]);

        table(
          ['Export ID', 'Format', 'Scope', 'Status', 'Records', 'Generated'],
          rows,
        );

        info(`\n${dim(`${items.length} export(s)`)}`);
      } catch (err) {
        error(`Failed to load export history: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });
}
