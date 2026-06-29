/**
 * @module @recurrsive/cli/config/loader
 *
 * Configuration loading and validation for the Recurrsive CLI.
 *
 * Searches for configuration files in standard locations, merges with
 * sensible defaults, validates against the Zod schema from
 * `@recurrsive/core`, and resolves relative paths.
 *
 * @packageDocumentation
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { RecurrsiveConfigSchema, type RecurrsiveConfig } from '@recurrsive/core';
import { ConfigError } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Default Config
// ---------------------------------------------------------------------------

/**
 * Minimal default configuration used when no config file is found.
 *
 * @param projectName - Fallback project name.
 * @returns A valid {@link RecurrsiveConfig} with sensible defaults.
 */
function createDefaultConfig(projectName: string): RecurrsiveConfig {
  return RecurrsiveConfigSchema.parse({
    version: '1',
    project: { name: projectName },
    graph: { provider: 'sqlite' },
    collectors: [],
    analyzers: { enabled: ['*'], disabled: [], config: {} },
    governance: {},
    policies: [],
    output: { format: 'markdown', directory: '.recurrsive' },
  });
}

// ---------------------------------------------------------------------------
// Config File Search
// ---------------------------------------------------------------------------

/** Ordered list of config file names to search for. */
const CONFIG_FILE_NAMES = [
  '.recurrsive/config.json',
  '.recurrsive/config.yaml',
  '.recurrsive/config.yml',
  'recurrsive.config.json',
];

/**
 * Locate the configuration file by searching upward from `startDir`.
 *
 * @param startDir - Directory to start searching from.
 * @returns Absolute path to the config file, or `null` if not found.
 */
function findConfigFile(startDir: string): string | null {
  let dir = resolve(startDir);

  // Walk up at most 10 levels
  for (let i = 0; i < 10; i++) {
    for (const name of CONFIG_FILE_NAMES) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }

  return null;
}

// ---------------------------------------------------------------------------
// YAML-lite Parser (JSON-only; YAML requires external dep)
// ---------------------------------------------------------------------------

/**
 * Parse a configuration file. Supports JSON. For YAML files, a
 * best-effort JSON-subset parser is used (YAML that is also valid JSON).
 *
 * @param filePath - Absolute path to the config file.
 * @returns Parsed config object.
 * @throws {ConfigError} If the file cannot be read or parsed.
 */
async function parseConfigFile(filePath: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    throw new ConfigError(
      `Cannot read config file: ${filePath}`,
      'CONFIG_READ_ERROR',
      err,
    );
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch { // expected
    // If .yaml/.yml, attempt a simplistic key:value parse
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      throw new ConfigError(
        `YAML config files require valid JSON content. ` +
          `Please convert ${filePath} to JSON or install a YAML parser.`,
        'YAML_NOT_SUPPORTED',
      );
    }
    throw new ConfigError(
      `Failed to parse config file as JSON: ${filePath}`,
      'CONFIG_PARSE_ERROR',
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Options for {@link loadConfig}.
 */
export interface LoadConfigOptions {
  /** Directory to search from (default: `process.cwd()`). */
  cwd?: string;
  /** Explicit path to a config file (skips search). */
  configPath?: string;
  /** Fallback project name when no config is found. */
  projectName?: string;
}

/**
 * Result of loading configuration.
 */
export interface LoadConfigResult {
  /** The validated and merged configuration. */
  config: RecurrsiveConfig;
  /** Path to the config file that was loaded, or `null` if defaults. */
  configPath: string | null;
  /** The project root directory (dirname of config file, or cwd). */
  projectRoot: string;
}

/**
 * Load, validate, and resolve the Recurrsive project configuration.
 *
 * Search order:
 * 1. Explicit `configPath` option.
 * 2. Walk upward from `cwd` looking for standard config file names.
 * 3. Fall back to sensible defaults.
 *
 * @param options - Loading options.
 * @returns The loaded configuration and metadata.
 * @throws {ConfigError} If the config file exists but is invalid.
 */
export async function loadConfig(options?: LoadConfigOptions): Promise<LoadConfigResult> {
  const cwd = resolve(options?.cwd ?? process.cwd());

  // Locate config file
  let configFilePath: string | null = null;
  if (options?.configPath) {
    configFilePath = resolve(cwd, options.configPath);
    if (!existsSync(configFilePath)) {
      throw new ConfigError(
        `Specified config file not found: ${configFilePath}`,
        'CONFIG_NOT_FOUND',
      );
    }
  } else {
    configFilePath = findConfigFile(cwd);
  }

  // Determine project root
  const projectRoot = configFilePath
    ? dirname(configFilePath).replace(/[/\\]\.recurrsive$/, '')
    : cwd;

  // Load or create defaults
  let rawConfig: unknown;
  if (configFilePath) {
    rawConfig = await parseConfigFile(configFilePath);
  } else {
    // Use defaults with detected project name
    const projectName = options?.projectName ?? inferProjectName(cwd);
    return {
      config: createDefaultConfig(projectName),
      configPath: null,
      projectRoot,
    };
  }

  // Validate with Zod
  const result = RecurrsiveConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    throw new ConfigError(
      `Invalid configuration in ${configFilePath}:\n${result.error.message}`,
      'CONFIG_VALIDATION_ERROR',
      result.error,
    );
  }

  const config = result.data;

  // Resolve relative paths
  if (!config.graph.connection_string && config.graph.provider === 'sqlite') {
    // Default SQLite path within .recurrsive directory
    config.graph.connection_string = resolve(projectRoot, '.recurrsive', 'graph.db');
  }

  return {
    config,
    configPath: configFilePath,
    projectRoot,
  };
}

/**
 * Infer the project name from the directory name or package.json.
 *
 * @param dir - Project root directory.
 * @returns Inferred project name.
 */
function inferProjectName(dir: string): string {
  // Try to read package.json
  const pkgPath = join(dir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const raw = require('node:fs').readFileSync(pkgPath, 'utf-8') as string;
      const pkg = JSON.parse(raw) as Record<string, unknown>;
      if (typeof pkg['name'] === 'string') {
        return pkg['name'];
      }
    } catch { // expected
      // Fall through to directory name
    }
  }

  // Use last segment of the path
  const segments = dir.split(/[/\\]/);
  return segments[segments.length - 1] ?? 'my-project';
}
