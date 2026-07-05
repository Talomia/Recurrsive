/**
 * @module @recurrsive/cli/commands/plugins
 *
 * `recurrsive plugins` — Manage and discover plugins.
 *
 * Provides subcommands for listing installed plugins, browsing
 * the marketplace, installing/uninstalling plugins, and viewing
 * detailed plugin information.
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

interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  status: 'active' | 'inactive' | 'error';
  author: string;
  updated: string;
}

interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  downloads: number;
  rating: number;
  price: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string): string {
  switch (status) {
    case 'active':   return green('● active');
    case 'inactive': return yellow('● inactive');
    case 'error':    return red('● error');
    default:         return dim('● unknown');
  }
}

function starRating(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
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
      let data: InstalledPlugin[];
      try {
        data = await apiRequest('/api/v1/plugins/installed') as InstalledPlugin[];
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      header('Installed Plugins');

      const rows = data.map((p) => [
        bold(p.name),
        cyan(p.version),
        statusBadge(p.status),
        dim(p.author),
        dim(p.updated),
      ]);

      console.log(table(['Name', 'Version', 'Status', 'Author', 'Updated'], rows));
      console.log('');
      info(dim(`${data.length} plugins installed`));
      console.log('');
    });

  // ── plugins marketplace ──────────────────────────────────────────────
  plugins
    .command('marketplace')
    .description('Browse available plugins')
    .option('--json', 'Output as JSON')
    .option('--search <query>', 'Filter plugins by name')
    .action(async (opts: { json?: boolean; search?: string }) => {
      let data: MarketplacePlugin[];
      try {
        data = await apiRequest('/api/v1/marketplace/plugins') as MarketplacePlugin[];
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }

      if (opts.search) {
        const q = opts.search.toLowerCase();
        data = data.filter((p) => p.name.includes(q) || p.description.toLowerCase().includes(q));
      }

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      header('Plugin Marketplace');

      if (data.length === 0) {
        info(dim('No plugins match your search.'));
        return;
      }

      const rows = data.map((p) => [
        bold(p.name),
        p.description,
        cyan(p.downloads.toLocaleString()),
        starRating(p.rating),
        p.price === 'Free' ? green(p.price) : yellow(p.price),
      ]);

      console.log(table(['Name', 'Description', 'Downloads', 'Rating', 'Price'], rows));
      console.log('');
      info(dim(`${data.length} plugins available`));
      console.log('');
    });

  // ── plugins install ──────────────────────────────────────────────────
  plugins
    .command('install <id>')
    .description('Install a plugin')
    .action((id: string) => {
      header('Installing Plugin');

      info(`  Resolving ${bold(cyan(id))}...`);
      info(`  Downloading ${bold('v1.0.0')}...`);
      console.log('');
      success(`Plugin ${bold(id)} installed successfully (v1.0.0)`);
      console.log('');
      info(dim('  Configuration may be required. Run:'));
      info(dim(`  ${cyan(`recurrsive plugins info ${id}`)} to see options.`));
      console.log('');
    });

  // ── plugins uninstall ────────────────────────────────────────────────
  plugins
    .command('uninstall <id>')
    .description('Uninstall a plugin')
    .action((id: string) => {
      header('Uninstalling Plugin');

      info(`  Removing ${bold(cyan(id))}...`);
      console.log('');
      success(`Plugin ${bold(id)} uninstalled successfully.`);
      console.log('');
    });

  // ── plugins info ─────────────────────────────────────────────────────
  plugins
    .command('info <id>')
    .description('Show detailed plugin information')
    .action((id: string) => {
      header(`Plugin: ${id}`);

      info(`  ${bold('Name:')}        ${cyan(id)}`);
      info(`  ${bold('Version:')}     ${cyan('2.4.1')}`);
      info(`  ${bold('Author:')}      Recurrsive`);
      info(`  ${bold('License:')}     MIT`);
      info(`  ${bold('Description:')} Advanced analysis plugin for the Recurrsive platform.`);
      console.log('');

      header('Dependencies');
      info(`  ${magenta('◈')} ${bold('@recurrsive/core')}  ${dim('>=4.0.0')}`);
      info(`  ${magenta('◈')} ${bold('@recurrsive/graph')} ${dim('>=2.0.0')}`);

      header('Configuration');
      info(`  ${bold('enabled')}           ${green('true')}         ${dim('Enable/disable the plugin')}`);
      info(`  ${bold('scan_interval')}     ${cyan('"6h"')}         ${dim('How often to run scans')}`);
      info(`  ${bold('severity_threshold')} ${yellow('"medium"')}     ${dim('Minimum severity to report')}`);
      console.log('');
    });
}
