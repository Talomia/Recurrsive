/**
 * Unit tests for the `recurrsive config` command.
 *
 * Tests cover:
 * - `config view` shows configuration when config file exists
 * - `config view --json` outputs valid JSON
 * - `config view` shows defaults when no config file found
 * - `config validate` succeeds with valid config
 * - `config validate` reports errors with invalid config
 * - `config path` prints the config file path
 * - `config path` handles missing config
 * - `config get` displays value for known key
 * - `config get` shows error for unknown key
 * - `config set` updates value
 * - `config reset` creates default config
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock external dependencies
// ---------------------------------------------------------------------------

vi.mock('../../config/loader.js', () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn().mockResolvedValue(undefined),
  getDefaultConfig: vi.fn(),
}));

vi.mock('@recurrsive/core', () => {
  const actual = {
    RecurrsiveConfigSchema: {
      safeParse: vi.fn(),
    },
    ConfigError: class ConfigError extends Error {
      code: string | undefined;
      constructor(message: string, code?: string) {
        super(message);
        this.name = 'ConfigError';
        this.code = code;
      }
    },
  };
  return actual;
});

vi.mock('../../output/terminal.js', () => ({
  banner: vi.fn(),
  header: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  bold: vi.fn((t: string) => t),
  cyan: vi.fn((t: string) => t),
  dim: vi.fn((t: string) => t),
  green: vi.fn((t: string) => t),
  yellow: vi.fn((t: string) => t),
  red: vi.fn((t: string) => t),
}));

import { loadConfig, saveConfig, getDefaultConfig } from '../../config/loader.js';
import { RecurrsiveConfigSchema, ConfigError } from '@recurrsive/core';
import { registerConfigCommand } from '../../commands/config.js';
import {
  banner,
  header,
  success,
  error as termError,
  warning,
  info,
} from '../../output/terminal.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A valid config object matching the resolved shape. */
const validConfig = {
  version: '1',
  project: { name: 'test-project' },
  graph: { provider: 'sqlite' as const },
  collectors: [],
  analyzers: { enabled: ['*'], disabled: [], config: {} },
  governance: {},
  policies: [],
  output: { format: 'markdown', directory: '.recurrsive' },
};

/** Default loadConfig mock return value with config file present. */
const withConfigFile = {
  config: validConfig,
  configPath: '/project/.recurrsive/config.json',
  projectRoot: '/project',
};

/** Default loadConfig mock return value without config file. */
const withoutConfigFile = {
  config: validConfig,
  configPath: null,
  projectRoot: '/project',
};

/**
 * Create a fake Commander program that captures the action handlers
 * for the `config` subcommands.
 */
function createFakeProgram() {
  const actions: Record<string, (...args: unknown[]) => Promise<void>> = {};

  const makeSubcommandChain = (name: string) => {
    const chain = {
      description: vi.fn().mockReturnThis(),
      option: vi.fn().mockReturnThis(),
      argument: vi.fn().mockReturnThis(),
      action: vi.fn((fn: (...args: unknown[]) => Promise<void>) => {
        actions[name] = fn;
        return chain;
      }),
    };
    return chain;
  };

  const configChain = {
    description: vi.fn().mockReturnThis(),
    command: vi.fn((name: string) => makeSubcommandChain(name)),
  };

  const program = {
    command: vi.fn().mockReturnValue(configChain),
  };

  registerConfigCommand(program as any);

  return {
    program,
    runView: (opts: { json?: boolean } = {}) => {
      if (!actions['view']) throw new Error('view action not registered');
      return actions['view'](opts);
    },
    runValidate: () => {
      if (!actions['validate']) throw new Error('validate action not registered');
      return actions['validate']({});
    },
    runPath: () => {
      if (!actions['path']) throw new Error('path action not registered');
      return actions['path']({});
    },
    runGet: (key: string) => {
      if (!actions['get']) throw new Error('get action not registered');
      return actions['get'](key);
    },
    runSet: (key: string, value: string) => {
      if (!actions['set']) throw new Error('set action not registered');
      return actions['set'](key, value);
    },
    runReset: () => {
      if (!actions['reset']) throw new Error('reset action not registered');
      return actions['reset']();
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerConfigCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (loadConfig as Mock).mockResolvedValue(withConfigFile);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  // ── Command Registration ───────────────────────────────────────────────

  describe('command registration', () => {
    it('registers the "config" command', () => {
      const { program } = createFakeProgram();
      expect(program.command).toHaveBeenCalledWith('config');
    });
  });

  // ── config view ────────────────────────────────────────────────────────

  describe('config view', () => {
    it('shows configuration when config file exists', async () => {
      const { runView } = createFakeProgram();
      await runView();

      expect(banner).toHaveBeenCalled();
      expect(header).toHaveBeenCalledWith('Resolved Configuration');
      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('/project/.recurrsive/config.json'),
      );
    });

    it('outputs valid JSON with --json flag', async () => {
      const { runView } = createFakeProgram();
      await runView({ json: true });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
      expect(output).toEqual(validConfig);
      // Should NOT call banner in JSON mode
      expect(banner).not.toHaveBeenCalled();
    });

    it('shows defaults when no config file found', async () => {
      (loadConfig as Mock).mockResolvedValue(withoutConfigFile);
      const { runView } = createFakeProgram();
      await runView();

      expect(banner).toHaveBeenCalled();
      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('defaults'),
      );
    });

    it('prints the project root', async () => {
      const { runView } = createFakeProgram();
      await runView();

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('/project'),
      );
    });
  });

  // ── config validate ────────────────────────────────────────────────────

  describe('config validate', () => {
    it('succeeds with valid config', async () => {
      (RecurrsiveConfigSchema.safeParse as Mock).mockReturnValue({
        success: true,
        data: validConfig,
      });

      const { runValidate } = createFakeProgram();
      await runValidate();

      expect(banner).toHaveBeenCalled();
      expect(header).toHaveBeenCalledWith('Configuration Validation');
      expect(success).toHaveBeenCalledWith(
        expect.stringContaining('valid'),
      );
    });

    it('shows summary details after successful validation', async () => {
      (RecurrsiveConfigSchema.safeParse as Mock).mockReturnValue({
        success: true,
        data: validConfig,
      });

      const { runValidate } = createFakeProgram();
      await runValidate();

      // Should display project name and graph provider
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('test-project'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('sqlite'),
      );
    });

    it('reports errors with invalid config', async () => {
      (RecurrsiveConfigSchema.safeParse as Mock).mockReturnValue({
        success: false,
        error: {
          issues: [
            { path: ['project', 'name'], message: 'Required' },
            { path: ['graph', 'provider'], message: 'Invalid enum value' },
          ],
        },
      });

      const { runValidate } = createFakeProgram();
      await runValidate();

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('validation errors'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('project.name'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('graph.provider'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('warns when no config file found', async () => {
      (loadConfig as Mock).mockResolvedValue(withoutConfigFile);

      const { runValidate } = createFakeProgram();
      await runValidate();

      expect(warning).toHaveBeenCalledWith(
        expect.stringContaining('No config file found'),
      );
    });

    it('handles ConfigError from loadConfig', async () => {
      (loadConfig as Mock).mockRejectedValue(
        new ConfigError('Bad config file', 'CONFIG_READ_ERROR'),
      );

      const { runValidate } = createFakeProgram();
      await runValidate();

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Bad config file'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('handles unexpected errors from loadConfig', async () => {
      (loadConfig as Mock).mockRejectedValue(new Error('Disk failure'));

      const { runValidate } = createFakeProgram();
      await runValidate();

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Disk failure'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── config path ────────────────────────────────────────────────────────

  describe('config path', () => {
    it('prints the config file path', async () => {
      const { runPath } = createFakeProgram();
      await runPath();

      expect(consoleSpy).toHaveBeenCalledWith(
        '/project/.recurrsive/config.json',
      );
    });

    it('handles missing config with error output', async () => {
      (loadConfig as Mock).mockResolvedValue(withoutConfigFile);

      const { runPath } = createFakeProgram();
      await runPath();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No config file found'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('prints project root when no config file', async () => {
      (loadConfig as Mock).mockResolvedValue(withoutConfigFile);

      const { runPath } = createFakeProgram();
      await runPath();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('/project'),
      );
    });
  });

  // ── config get ─────────────────────────────────────────────────────────

  describe('config get', () => {
    it('displays value for known key', async () => {
      const { runGet } = createFakeProgram();
      await runGet('graph.provider');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('graph.provider'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('sqlite'),
      );
    });

    it('displays output.format value via reports.format alias', async () => {
      const { runGet } = createFakeProgram();
      await runGet('reports.format');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('reports.format'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('markdown'),
      );
    });

    it('shows error for unknown key', async () => {
      const { runGet } = createFakeProgram();
      await runGet('nonexistent.key');

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Unknown config key'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('lists known keys when key is unknown', async () => {
      const { runGet } = createFakeProgram();
      await runGet('bad.key');

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('graph.provider'),
      );
    });
  });

  // ── config set ─────────────────────────────────────────────────────────

  describe('config set', () => {
    it('updates value and saves config', async () => {
      const { runSet } = createFakeProgram();
      await runSet('graph.provider', 'postgresql_age');

      expect(saveConfig).toHaveBeenCalled();
      expect(success).toHaveBeenCalledWith(
        expect.stringContaining('graph.provider'),
      );
      expect(success).toHaveBeenCalledWith(
        expect.stringContaining('postgresql_age'),
      );
    });

    it('shows error for unknown key', async () => {
      const { runSet } = createFakeProgram();
      await runSet('unknown.setting', 'value');

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Unknown config key'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(saveConfig).not.toHaveBeenCalled();
    });

    it('writes config to .recurrsive/config.yaml', async () => {
      const { runSet } = createFakeProgram();
      await runSet('output.format', 'json');

      expect(saveConfig).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('.recurrsive/config.yaml'),
      );
    });
  });

  // ── config reset ───────────────────────────────────────────────────────

  describe('config reset', () => {
    it('creates default config and writes to file', async () => {
      const defaultCfg = { ...validConfig, project: { name: 'my-project' } };
      (getDefaultConfig as Mock).mockReturnValue(defaultCfg);

      const { runReset } = createFakeProgram();
      await runReset();

      expect(getDefaultConfig).toHaveBeenCalled();
      expect(saveConfig).toHaveBeenCalledWith(
        defaultCfg,
        expect.stringContaining('.recurrsive/config.yaml'),
      );
      expect(success).toHaveBeenCalledWith(
        expect.stringContaining('reset to defaults'),
      );
    });

    it('shows the output path', async () => {
      const defaultCfg = { ...validConfig };
      (getDefaultConfig as Mock).mockReturnValue(defaultCfg);

      const { runReset } = createFakeProgram();
      await runReset();

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('.recurrsive/config.yaml'),
      );
    });
  });
});
