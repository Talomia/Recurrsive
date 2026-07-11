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
import { existsSync, readFileSync } from 'node:fs';
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
  } catch { // expected for non-JSON
    // If .yaml/.yml, parse as YAML
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      try {
        return parseSimpleYaml(raw);
      } catch (yamlErr: unknown) {
        throw new ConfigError(
          `Failed to parse YAML config file: ${filePath}`,
          'CONFIG_PARSE_ERROR',
          yamlErr,
        );
      }
    }
    throw new ConfigError(
      `Failed to parse config file as JSON: ${filePath}`,
      'CONFIG_PARSE_ERROR',
    );
  }
}

/**
 * Lightweight YAML parser for config files.
 *
 * Supports:
 * - Key-value pairs (`key: value`)
 * - Nested objects via indentation
 * - Array items (`- item`)
 * - Booleans, numbers, null
 * - Single and double quoted strings
 * - Comments (`# ...`)
 * - Empty values (treated as empty string)
 *
 * Does NOT support:
 * - Multi-line strings (`|`, `>`)
 * - Anchors and aliases (`&`, `*`)
 * - Flow syntax (`{a: 1}`, `[1, 2]`)
 * - Tags (`!!str`, `!!int`)
 *
 * This is sufficient for Recurrsive config files.
 */
function parseSimpleYaml(text: string): unknown {
  const lines = text.split('\n');
  const result: Record<string, unknown> = {};
  const stack: Array<{ indent: number; obj: Record<string, unknown> }> = [
    { indent: -1, obj: result },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Skip empty lines and comments
    const trimmed = line.replace(/#.*$/, '').trimEnd();
    if (trimmed.trim() === '') continue;

    const indent = line.search(/\S/);
    if (indent < 0) continue;

    // Pop stack to find parent
    while (stack.length > 1 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1]!.obj;

    // Array item
    if (trimmed.trim().startsWith('- ')) {
      const arrValue = trimmed.trim().slice(2).trim();
      // Find which key this array belongs to (last key in parent)
      const keys = Object.keys(parent);
      const lastKey = keys[keys.length - 1];
      if (lastKey && Array.isArray(parent[lastKey])) {
        (parent[lastKey] as unknown[]).push(parseYamlValue(arrValue));
      }
      continue;
    }

    // Key-value pair
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim();
      const rawVal = trimmed.slice(colonIdx + 1).trim();

      if (rawVal === '' || rawVal === undefined) {
        // Check if next line is indented more (nested object) or starts with '- ' (array)
        const nextLine = i + 1 < lines.length ? lines[i + 1]! : '';
        const nextTrimmed = nextLine.replace(/#.*$/, '').trimEnd();
        const nextIndent = nextLine.search(/\S/);

        if (nextIndent > indent && nextTrimmed.trim().startsWith('- ')) {
          // Array
          parent[key] = [];
        } else if (nextIndent > indent) {
          // Nested object
          const nested: Record<string, unknown> = {};
          parent[key] = nested;
          stack.push({ indent, obj: nested });
        } else {
          parent[key] = '';
        }
      } else {
        parent[key] = parseYamlValue(rawVal);
      }
    }
  }

  return result;
}

/** Parse a YAML scalar value into a JS primitive. */
function parseYamlValue(val: string): unknown {
  if (val === 'true' || val === 'True' || val === 'TRUE') return true;
  if (val === 'false' || val === 'False' || val === 'FALSE') return false;
  if (val === 'null' || val === 'Null' || val === 'NULL' || val === '~') return null;

  // Quoted string
  if ((val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))) {
    return val.slice(1, -1);
  }

  // Number
  const num = Number(val);
  if (!isNaN(num) && val !== '') return num;

  return val;
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
 * Save a configuration object to the specified path.
 *
 * @param config - The configuration object to save.
 * @param configPath - Absolute path to write the config file.
 */
export async function saveConfig(config: RecurrsiveConfig, configPath: string): Promise<void> {
  const { writeFile: fsWrite } = await import('node:fs/promises');
  const { dirname: pathDirname } = await import('node:path');
  const { mkdir } = await import('node:fs/promises');

  // Ensure the directory exists
  await mkdir(pathDirname(configPath), { recursive: true });
  await fsWrite(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Create and return a default configuration.
 *
 * @param projectName - Optional fallback project name.
 * @returns A valid default {@link RecurrsiveConfig}.
 */
export function getDefaultConfig(projectName?: string): RecurrsiveConfig {
  return createDefaultConfig(projectName ?? 'my-project');
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
      const raw = readFileSync(pkgPath, 'utf-8') as string;
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
