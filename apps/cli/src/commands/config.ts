/**
 * @module @recurrsive/cli/commands/config
 *
 * `recurrsive config` — View, validate, and inspect configuration.
 *
 * Subcommands:
 * - `view` — Load and pretty-print the resolved configuration.
 * - `validate` — Validate the config file and report schema errors.
 * - `path` — Print the path to the active config file.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import { RecurrsiveConfigSchema } from '@recurrsive/core';
import { ConfigError } from '@recurrsive/core';
import { loadConfig } from '../config/loader.js';
import {
  banner,
  header,
  success,
  error,
  warning,
  info,
  bold,
  cyan,
  dim,
  green,
  yellow,
  red,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pretty-print a config value with ANSI colour coding.
 *
 * Renders objects/arrays as indented coloured output rather than
 * raw JSON for improved readability.
 *
 * @param value - The value to print.
 * @param indent - Current indentation depth.
 */
function prettyPrint(value: unknown, indent = 0): void {
  const pad = '  '.repeat(indent);

  if (value === null || value === undefined) {
    console.log(`${pad}${dim(String(value))}`);
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      console.log(`${pad}${dim('[]')}`);
      return;
    }
    for (const item of value) {
      if (typeof item === 'object' && item !== null) {
        console.log(`${pad}${dim('-')}`);
        prettyPrint(item, indent + 1);
      } else {
        console.log(`${pad}${dim('-')} ${cyan(String(item))}`);
      }
    }
    return;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    for (const [key, val] of entries) {
      if (typeof val === 'object' && val !== null) {
        console.log(`${pad}${bold(key)}:`);
        prettyPrint(val, indent + 1);
      } else if (typeof val === 'boolean') {
        console.log(
          `${pad}${bold(key)}: ${val ? green(String(val)) : yellow(String(val))}`,
        );
      } else if (typeof val === 'number') {
        console.log(`${pad}${bold(key)}: ${cyan(String(val))}`);
      } else if (val === null || val === undefined) {
        console.log(`${pad}${bold(key)}: ${dim(String(val))}`);
      } else {
        console.log(`${pad}${bold(key)}: ${cyan(String(val))}`);
      }
    }
    return;
  }

  console.log(`${pad}${cyan(String(value))}`);
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `config` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('View, validate, and inspect Recurrsive configuration');

  // ── config view ──────────────────────────────────────────────
  configCmd
    .command('view')
    .description('Load and display the resolved configuration')
    .option('--json', 'Output as raw JSON')
    .action(async (opts: { json?: boolean }) => {
      const { config, configPath, projectRoot } = await loadConfig();

      if (opts.json) {
        console.log(JSON.stringify(config, null, 2));
        return;
      }

      banner();
      header('Resolved Configuration');

      if (configPath) {
        info(`Config file: ${dim(configPath)}`);
      } else {
        info(`No config file found — using ${bold('defaults')}`);
      }
      info(`Project root: ${dim(projectRoot)}`);
      console.log('');

      prettyPrint(config);
      console.log('');
    });

  // ── config validate ──────────────────────────────────────────
  configCmd
    .command('validate')
    .description('Validate the configuration file and report errors')
    .action(async () => {
      banner();
      header('Configuration Validation');

      try {
        const { config, configPath } = await loadConfig();

        if (!configPath) {
          warning(
            'No config file found. Using default configuration.',
          );
          console.log('');
          info(
            `Create one with ${bold(cyan('recurrsive init'))} ` +
              `or place a config at ${dim('.recurrsive/config.json')}`,
          );
          console.log('');
          return;
        }

        info(`Validating: ${dim(configPath)}`);
        console.log('');

        // Re-validate explicitly against the schema for detailed output
        const result = RecurrsiveConfigSchema.safeParse(config);

        if (result.success) {
          success('Configuration is valid ✨');
          console.log('');

          // Show a summary of what was validated
          console.log(`  ${bold('Project:')}     ${cyan(config.project.name)}`);
          console.log(`  ${bold('Graph:')}       ${cyan(config.graph.provider)}`);
          console.log(`  ${bold('Output:')}      ${cyan(config.output.directory)}`);
          console.log(`  ${bold('Format:')}      ${cyan(config.output.format)}`);

          const analyzerCount =
            config.analyzers.enabled.length === 1 &&
            config.analyzers.enabled[0] === '*'
              ? 'all'
              : String(config.analyzers.enabled.length);
          console.log(
            `  ${bold('Analyzers:')}   ${cyan(analyzerCount)} enabled`,
          );

          if (config.reasoning) {
            console.log(
              `  ${bold('Reasoning:')}   ${green('configured')} (${cyan(config.reasoning.provider)})`,
            );
          } else {
            console.log(
              `  ${bold('Reasoning:')}   ${dim('not configured')}`,
            );
          }

          console.log('');
        } else {
          error('Configuration has validation errors:');
          console.log('');

          for (const issue of result.error.issues) {
            const path = issue.path.length > 0
              ? issue.path.join('.')
              : '(root)';
            console.log(
              `  ${red('✖')} ${bold(path)}: ${issue.message}`,
            );
          }
          console.log('');
          process.exit(1);
        }
      } catch (err: unknown) {
        if (err instanceof ConfigError) {
          error(`Configuration error: ${err.message}`);
          if (err.code) {
            console.log(`  ${dim(`Error code: ${err.code}`)}`);
          }
        } else {
          error(
            `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        console.log('');
        process.exit(1);
      }
    });

  // ── config path ──────────────────────────────────────────────
  configCmd
    .command('path')
    .description('Print the path to the active config file')
    .action(async () => {
      const { configPath, projectRoot } = await loadConfig();

      if (configPath) {
        console.log(configPath);
      } else {
        // No config file — print to stderr so stdout remains clean
        console.error(
          `${yellow('⚠')} No config file found. Using defaults.`,
        );
        console.error(
          `  Project root: ${dim(projectRoot)}`,
        );
        process.exit(1);
      }
    });
}
