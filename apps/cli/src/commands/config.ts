/**
 * @module @recurrsive/cli/commands/config
 *
 * `recurrsive config` — View, validate, and inspect configuration.
 *
 * Subcommands:
 * - `view` — Load and pretty-print the resolved configuration.
 * - `validate` — Validate the config file and report schema errors.
 * - `path` — Print the path to the active config file.
 * - `get <key>` — Read a specific config value by dot-notation key.
 * - `set <key> <value>` — Set a config value by dot-notation key.
 * - `reset` — Reset config to defaults.
 *
 * @packageDocumentation
 */

import { join } from 'node:path';
import type { Command } from 'commander';
import { RecurrsiveConfigSchema } from '@recurrsive/core';
import { ConfigError } from '@recurrsive/core';
import { loadConfig, saveConfig, getDefaultConfig } from '../config/loader.js';
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
 * Known dot-notation config keys that users can get/set.
 */
const KNOWN_KEYS = [
  'graph.provider',
  'analysis.severity_threshold',
  'analysis.max_findings',
  'reports.format',
  'reports.output_dir',
  'project.name',
  'project.description',
  'output.format',
  'output.directory',
  'governance.pii_detection',
  'governance.retention_days',
] as const;

/**
 * Resolve a dot-notation key against a config object.
 *
 * Maps user-facing keys to the actual nested config shape:
 * - `analysis.severity_threshold` → `analyzers.config.severity_threshold`
 * - `analysis.max_findings` → `analyzers.config.max_findings`
 * - `reports.format` → `output.format`
 * - `reports.output_dir` → `output.directory`
 * - All others traverse directly by dot path.
 *
 * @param config - The config object.
 * @param key - Dot-notation key.
 * @returns The resolved value, or `undefined` if not found.
 */
function getConfigValue(config: Record<string, unknown>, key: string): unknown {
  // Map user-friendly aliases to actual config paths
  const mapped = mapKeyToPath(key);
  const parts = mapped.split('.');
  let current: unknown = config;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Set a value in a config object by dot-notation key.
 *
 * @param config - The config object to mutate.
 * @param key - Dot-notation key.
 * @param value - The value to set (will be coerced from string).
 */
function setConfigValue(config: Record<string, unknown>, key: string, value: string): void {
  const mapped = mapKeyToPath(key);
  const parts = mapped.split('.');
  let current: Record<string, unknown> = config;

  // Navigate to the parent object, creating intermediates as needed
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (current[part] === undefined || current[part] === null || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1]!;
  current[lastPart] = coerceValue(value);
}

/**
 * Map user-facing keys to the actual config structure paths.
 */
function mapKeyToPath(key: string): string {
  switch (key) {
    case 'analysis.severity_threshold':
      return 'analyzers.config.severity_threshold';
    case 'analysis.max_findings':
      return 'analyzers.config.max_findings';
    case 'reports.format':
      return 'output.format';
    case 'reports.output_dir':
      return 'output.directory';
    default:
      return key;
  }
}

/**
 * Coerce a CLI string value to the appropriate JS type.
 */
function coerceValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  const num = Number(value);
  if (!isNaN(num) && value !== '') return num;
  return value;
}

/**
 * Check whether a key is in the set of known config keys.
 */
function isKnownKey(key: string): boolean {
  return (KNOWN_KEYS as readonly string[]).includes(key);
}

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

  // ── config get <key> ─────────────────────────────────────────
  configCmd
    .command('get')
    .description('Read a specific config value by dot-notation key')
    .argument('<key>', 'Config key in dot-notation (e.g., graph.provider)')
    .action(async (key: string) => {
      if (!isKnownKey(key)) {
        error(`Unknown config key: ${bold(key)}`);
        console.log('');
        info(`Known keys: ${KNOWN_KEYS.map((k) => cyan(k)).join(', ')}`);
        console.log('');
        process.exit(1);
        return;
      }

      const { config } = await loadConfig();
      const value = getConfigValue(config as unknown as Record<string, unknown>, key);

      console.log(`${bold(key)}: ${cyan(String(value ?? 'undefined'))}`);
    });

  // ── config set <key> <value> ─────────────────────────────────
  configCmd
    .command('set')
    .description('Set a config value by dot-notation key')
    .argument('<key>', 'Config key in dot-notation (e.g., graph.provider)')
    .argument('<value>', 'Value to set')
    .action(async (key: string, value: string) => {
      if (!isKnownKey(key)) {
        error(`Unknown config key: ${bold(key)}`);
        console.log('');
        info(`Known keys: ${KNOWN_KEYS.map((k) => cyan(k)).join(', ')}`);
        console.log('');
        process.exit(1);
        return;
      }

      const { config, projectRoot } = await loadConfig();
      const configObj = config as unknown as Record<string, unknown>;
      setConfigValue(configObj, key, value);

      const configPath = join(projectRoot, '.recurrsive', 'config.json');
      await saveConfig(config, configPath);

      success(`Set ${bold(key)} = ${cyan(value)}`);
    });

  // ── config reset ─────────────────────────────────────────────
  configCmd
    .command('reset')
    .description('Reset configuration to defaults')
    .action(async () => {
      const { projectRoot } = await loadConfig();
      const defaultConfig = getDefaultConfig();
      const configPath = join(projectRoot, '.recurrsive', 'config.json');

      await saveConfig(defaultConfig, configPath);

      success('Configuration reset to defaults');
      info(`Written to: ${dim(configPath)}`);
    });
}
