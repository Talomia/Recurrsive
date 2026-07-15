/**
 * @module @recurrsive/cli/commands/plugins
 *
 * `recurrsive plugins` — Manage and discover plugins.
 *
 * All actions are backed by the server's `/api/v1/plugins/*` endpoints.
 * The CLI reports exactly what the server returns — no placeholder
 * versions, authors, or dependency lists.
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
  yellow,
  red,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types (match the server response shapes)
// ---------------------------------------------------------------------------

interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  type: string;
  status: 'installed' | 'enabled' | 'disabled' | 'error' | 'updating';
  installedAt: string;
  updatedAt: string;
  tags: string[];
}

interface MarketplaceEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: string;
  tags: string[];
  downloads: number;
  rating: number;
  verified: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string): string {
  switch (status) {
    case 'enabled':   return green('● enabled');
    case 'installed': return cyan('● installed');
    case 'disabled':  return yellow('● disabled');
    case 'updating':  return cyan('● updating');
    case 'error':     return red('● error');
    default:          return dim(`● ${status}`);
  }
}

function starRating(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = Math.max(0, 5 - full - half);
  return yellow('★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty));
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `plugins` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerPluginsCommand(program: Command): void {
  const plugins = program
    .command('plugins')
    .description('Manage and discover plugins');

  // ── plugins list ─────────────────────────────────────────────────────
  plugins
    .command('list')
    .description('List installed plugins')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let items: InstalledPlugin[];
      let total: number;
      try {
        const res = await apiRequestList<InstalledPlugin>('/api/v1/plugins/installed');
        items = res.items;
        total = res.total;
      } catch (err) {
        reportApiError(err, { action: 'List installed plugins' });
      }

      if (opts.json) {
        console.log(JSON.stringify(items, null, 2));
        return;
      }

      header('Installed Plugins');

      if (items.length === 0) {
        info(dim('No plugins installed. Browse `recurrsive plugins marketplace`.'));
        return;
      }

      const rows = items.map((p) => [
        bold(p.name),
        cyan(p.version),
        statusBadge(p.status),
        dim(p.author),
        dim(p.updatedAt),
      ]);
      console.log(table(['Name', 'Version', 'Status', 'Author', 'Updated'], rows));
      console.log('');
      info(dim(`${total} plugin(s) installed`));
      console.log('');
    });

  // ── plugins marketplace ──────────────────────────────────────────────
  plugins
    .command('marketplace')
    .description('Browse available plugins')
    .option('--json', 'Output as JSON')
    .option('--search <query>', 'Filter plugins by name/description/tag')
    .action(async (opts: { json?: boolean; search?: string }) => {
      const qs = opts.search ? `?search=${encodeURIComponent(opts.search)}` : '';
      let items: MarketplaceEntry[];
      let total: number;
      try {
        const res = await apiRequestList<MarketplaceEntry>(
          `/api/v1/plugins/marketplace${qs}`,
        );
        items = res.items;
        total = res.total;
      } catch (err) {
        reportApiError(err, { action: 'Browse marketplace' });
      }

      if (opts.json) {
        console.log(JSON.stringify(items, null, 2));
        return;
      }

      header('Plugin Marketplace');

      if (items.length === 0) {
        info(dim('No plugins match your search.'));
        return;
      }

      const rows = items.map((p) => [
        bold(p.name),
        p.description,
        cyan(p.downloads.toLocaleString()),
        starRating(p.rating),
        p.verified ? green('verified') : dim('community'),
      ]);
      console.log(table(['Name', 'Description', 'Downloads', 'Rating', 'Source'], rows));
      console.log('');
      info(dim(`${total} plugin(s) available`));
      console.log('');
    });

  // ── plugins install ──────────────────────────────────────────────────
  plugins
    .command('install <id>')
    .description('Install a plugin from the marketplace')
    .action(async (id: string) => {
      header('Installing Plugin');

      let plugin: InstalledPlugin;
      try {
        plugin = await apiRequest(`/api/v1/plugins/install/${encodeURIComponent(id)}`, {
          method: 'POST',
        }).then((env) => (env as { data: InstalledPlugin }).data);
      } catch (err) {
        reportApiError(err, { resource: `plugin '${id}'`, action: 'Install plugin' });
      }

      success(`Installed ${bold(plugin.name)} ${cyan(`v${plugin.version}`)} (${plugin.status})`);
      console.log('');
      info(dim(`Run ${cyan(`recurrsive plugins info ${plugin.id}`)} to see details.`));
      console.log('');
    });

  // ── plugins uninstall ────────────────────────────────────────────────
  plugins
    .command('uninstall <id>')
    .description('Uninstall a plugin')
    .action(async (id: string) => {
      header('Uninstalling Plugin');

      try {
        await apiRequest(`/api/v1/plugins/installed/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        reportApiError(err, { resource: `plugin '${id}'`, action: 'Uninstall plugin' });
      }

      success(`Plugin ${bold(id)} uninstalled.`);
      console.log('');
    });

  // ── plugins info ─────────────────────────────────────────────────────
  plugins
    .command('info <id>')
    .description('Show detailed plugin information')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts: { json?: boolean }) => {
      // Prefer the installed record; fall back to the marketplace entry.
      let plugin: InstalledPlugin | MarketplaceEntry | undefined;
      let installed = false;
      try {
        plugin = await apiRequest(
          `/api/v1/plugins/installed/${encodeURIComponent(id)}`,
        ).then((env) => (env as { data: InstalledPlugin }).data);
        installed = true;
      } catch {
        try {
          plugin = await apiRequest(
            `/api/v1/plugins/marketplace/${encodeURIComponent(id)}`,
          ).then((env) => (env as { data: MarketplaceEntry }).data);
        } catch (err) {
          reportApiError(err, { resource: `plugin '${id}'`, action: 'Get plugin info' });
        }
      }

      if (opts.json) {
        console.log(JSON.stringify(plugin, null, 2));
        return;
      }

      header(`Plugin: ${plugin!.name}`);
      info(`  ${bold('ID:')}          ${cyan(plugin!.id)}`);
      info(`  ${bold('Name:')}        ${cyan(plugin!.name)}`);
      info(`  ${bold('Version:')}     ${cyan(plugin!.version)}`);
      info(`  ${bold('Author:')}      ${plugin!.author}`);
      info(`  ${bold('Type:')}        ${plugin!.type}`);
      info(`  ${bold('Description:')} ${plugin!.description}`);
      if (installed && 'status' in plugin!) {
        info(`  ${bold('Status:')}      ${statusBadge(plugin.status)}`);
      } else if ('verified' in plugin!) {
        info(`  ${bold('Verified:')}    ${plugin.verified ? green('yes') : dim('no')}`);
      }
      if (plugin!.tags?.length) {
        info(`  ${bold('Tags:')}        ${dim(plugin!.tags.join(', '))}`);
      }
      console.log('');
    });
}
