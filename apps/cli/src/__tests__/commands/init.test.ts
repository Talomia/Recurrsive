/**
 * Unit tests for the `recurrsive init` command.
 *
 * Tests cover:
 * - Creating `.recurrsive/` directory and subdirectories
 * - Writing `config.json` with valid schema
 * - Detecting project type from package.json
 * - Handling already-initialized projects (shows warning)
 * - Working with a custom path argument
 * - Detecting frameworks and AI providers from dependencies
 * - Force-reinitializing when --force is used
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock all external dependencies BEFORE importing the module under test
// ---------------------------------------------------------------------------

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
}));

// Mock @recurrsive/core
vi.mock('@recurrsive/core', () => ({
  RecurrsiveConfigSchema: {
    parse: vi.fn((input: unknown) => input),
  },
}));

// Mock terminal output helpers (all functions are no-ops/identity)
vi.mock('../../output/terminal.js', () => ({
  banner: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  bold: vi.fn((t: string) => t),
  cyan: vi.fn((t: string) => t),
  green: vi.fn((t: string) => t),
  dim: vi.fn((t: string) => t),
  magenta: vi.fn((t: string) => t),
  header: vi.fn(),
}));

import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { registerInitCommand } from '../../commands/init.js';
import { warning, info, banner, success } from '../../output/terminal.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a fake Commander program that captures the registered action.
 * Returns the action handler so tests can invoke it directly.
 */
function createFakeProgram() {
  let actionHandler: ((pathArg: string, opts: { force?: boolean }) => Promise<void>) | null = null;

  const commandChain = {
    description: vi.fn().mockReturnThis(),
    argument: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    action: vi.fn((fn: typeof actionHandler) => {
      actionHandler = fn;
      return commandChain;
    }),
  };

  const program = {
    command: vi.fn().mockReturnValue(commandChain),
  };

  registerInitCommand(program as any);

  return {
    program,
    commandChain,
    runAction: (pathArg = '.', opts: { force?: boolean } = {}) => {
      if (!actionHandler) throw new Error('action not registered');
      return actionHandler(pathArg, opts);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerInitCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no files exist
    (existsSync as Mock).mockReturnValue(false);
  });

  // ── Command Registration ───────────────────────────────────────────────

  describe('command registration', () => {
    it('registers the "init" command on the program', () => {
      const { program } = createFakeProgram();
      expect(program.command).toHaveBeenCalledWith('init');
    });

    it('sets description, argument and options', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.description).toHaveBeenCalledWith(
        'Initialize Recurrsive in a project',
      );
      expect(commandChain.argument).toHaveBeenCalledWith(
        '[path]',
        'Path to the project root',
        '.',
      );
      expect(commandChain.option).toHaveBeenCalledWith(
        '-f, --force',
        'Overwrite existing configuration',
      );
    });
  });

  // ── Directory & Config Creation ────────────────────────────────────────

  describe('directory and config creation', () => {
    it('creates .recurrsive/ directory', async () => {
      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      const projectDir = resolve('.');
      const recurrsiveDir = join(projectDir, '.recurrsive');

      expect(mkdir).toHaveBeenCalledWith(recurrsiveDir, { recursive: true });
      consoleSpy.mockRestore();
    });

    it('creates snapshots/ and reports/ subdirectories', async () => {
      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      const projectDir = resolve('.');
      const recurrsiveDir = join(projectDir, '.recurrsive');

      expect(mkdir).toHaveBeenCalledWith(
        join(recurrsiveDir, 'snapshots'),
        { recursive: true },
      );
      expect(mkdir).toHaveBeenCalledWith(
        join(recurrsiveDir, 'reports'),
        { recursive: true },
      );
      consoleSpy.mockRestore();
    });

    it('writes config.json with JSON content', async () => {
      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      const projectDir = resolve('.');
      const configPath = join(projectDir, '.recurrsive', 'config.json');

      expect(writeFile).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('{'),
        'utf-8',
      );
      consoleSpy.mockRestore();
    });

    it('writes a .gitignore inside .recurrsive/', async () => {
      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      const projectDir = resolve('.');
      const gitignorePath = join(projectDir, '.recurrsive', '.gitignore');

      expect(writeFile).toHaveBeenCalledWith(
        gitignorePath,
        expect.stringContaining('graph.db'),
        'utf-8',
      );
      consoleSpy.mockRestore();
    });

    it('does not overwrite existing .gitignore', async () => {
      (existsSync as Mock).mockImplementation((path: string) => {
        // Only the .gitignore exists, not config.json
        return path.endsWith('.gitignore');
      });

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      // writeFile should be called for config.json but NOT for .gitignore
      const writeFileCalls = (writeFile as Mock).mock.calls;
      const gitignoreWrites = writeFileCalls.filter((call: unknown[]) =>
        (call[0] as string).endsWith('.gitignore'),
      );
      expect(gitignoreWrites).toHaveLength(0);
      consoleSpy.mockRestore();
    });

    it('calls banner() at the start', async () => {
      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      expect(banner).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('calls success() after creating config', async () => {
      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      expect(success).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ── Project Type Detection ─────────────────────────────────────────────

  describe('project type detection', () => {
    it('detects node project type from package.json', async () => {
      (existsSync as Mock).mockImplementation((path: string) => {
        return path.endsWith('package.json');
      });

      (readFile as Mock).mockResolvedValue(
        JSON.stringify({
          name: 'my-app',
          dependencies: { typescript: '^5.0.0' },
        }),
      );

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      // The config should use the detected project name
      const writeFileCalls = (writeFile as Mock).mock.calls;
      const configCall = writeFileCalls.find((call: unknown[]) =>
        (call[0] as string).endsWith('config.json'),
      );
      expect(configCall).toBeDefined();
      const writtenConfig = JSON.parse(
        (configCall![1] as string).trim(),
      );
      expect(writtenConfig.project.name).toBe('my-app');
      consoleSpy.mockRestore();
    });

    it('detects frameworks from package.json dependencies', async () => {
      (existsSync as Mock).mockImplementation((path: string) => {
        return path.endsWith('package.json');
      });

      (readFile as Mock).mockResolvedValue(
        JSON.stringify({
          name: 'nextjs-app',
          dependencies: { next: '^14.0.0', react: '^18.0.0' },
        }),
      );

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      // The console.log should have been called with framework info
      const logCalls = consoleSpy.mock.calls;
      const frameworkLine = logCalls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('Frameworks'),
      );
      expect(frameworkLine).toBeDefined();
      consoleSpy.mockRestore();
    });

    it('detects AI providers from package.json', async () => {
      (existsSync as Mock).mockImplementation((path: string) => {
        return path.endsWith('package.json');
      });

      (readFile as Mock).mockResolvedValue(
        JSON.stringify({
          name: 'ai-app',
          dependencies: { openai: '^4.0.0' },
        }),
      );

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      // info() should mention AI providers
      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('AI providers detected'),
      );
      consoleSpy.mockRestore();
    });

    it('uses basename as project name when no package.json', async () => {
      // No files exist at all
      (existsSync as Mock).mockReturnValue(false);

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction('/tmp/my-cool-project');

      const writeFileCalls = (writeFile as Mock).mock.calls;
      const configCall = writeFileCalls.find((call: unknown[]) =>
        (call[0] as string).endsWith('config.json'),
      );
      expect(configCall).toBeDefined();
      const writtenConfig = JSON.parse((configCall![1] as string).trim());
      expect(writtenConfig.project.name).toBe('my-cool-project');
      consoleSpy.mockRestore();
    });

    it('detects python project from pyproject.toml', async () => {
      (existsSync as Mock).mockImplementation((path: string) => {
        return path.endsWith('pyproject.toml');
      });

      (readFile as Mock).mockResolvedValue(
        '[tool.poetry]\nname = "my-py-app"\n\n[tool.poetry.dependencies]\nfastapi = "^0.100.0"\n',
      );

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      // Should detect frameworks via pyproject.toml content
      const logCalls = consoleSpy.mock.calls;
      const frameworkLine = logCalls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('Frameworks'),
      );
      expect(frameworkLine).toBeDefined();
      consoleSpy.mockRestore();
    });
  });

  // ── Already Initialized ────────────────────────────────────────────────

  describe('already initialized project', () => {
    it('shows a warning when config.json already exists', async () => {
      (existsSync as Mock).mockImplementation((path: string) => {
        return path.endsWith('config.json');
      });

      const { runAction } = createFakeProgram();
      await runAction();

      expect(warning).toHaveBeenCalledWith(
        expect.stringContaining('already initialized'),
      );
    });

    it('suggests using --force to reinitialize', async () => {
      (existsSync as Mock).mockImplementation((path: string) => {
        return path.endsWith('config.json');
      });

      const { runAction } = createFakeProgram();
      await runAction();

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('--force'),
      );
    });

    it('does NOT create directories when already initialized', async () => {
      (existsSync as Mock).mockImplementation((path: string) => {
        return path.endsWith('config.json');
      });

      const { runAction } = createFakeProgram();
      await runAction();

      expect(mkdir).not.toHaveBeenCalled();
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('reinitializes when --force is passed', async () => {
      (existsSync as Mock).mockImplementation((path: string) => {
        // config.json exists, but force flag overrides
        return path.endsWith('config.json');
      });

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction('.', { force: true });

      // Should create directories despite existing config
      expect(mkdir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ── Custom Path ────────────────────────────────────────────────────────

  describe('custom path argument', () => {
    it('resolves custom path and creates .recurrsive/ inside it', async () => {
      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction('/tmp/custom-project');

      const expectedDir = join(resolve('/tmp/custom-project'), '.recurrsive');
      expect(mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
      consoleSpy.mockRestore();
    });

    it('writes config.json to the custom path', async () => {
      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction('/tmp/custom-project');

      const expectedConfig = join(
        resolve('/tmp/custom-project'),
        '.recurrsive',
        'config.json',
      );
      expect(writeFile).toHaveBeenCalledWith(
        expectedConfig,
        expect.any(String),
        'utf-8',
      );
      consoleSpy.mockRestore();
    });
  });

  // ── Config Content ─────────────────────────────────────────────────────

  describe('generated config content', () => {
    it('includes graph provider set to sqlite', async () => {
      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      const writeFileCalls = (writeFile as Mock).mock.calls;
      const configCall = writeFileCalls.find((call: unknown[]) =>
        (call[0] as string).endsWith('config.json'),
      );
      const writtenConfig = JSON.parse((configCall![1] as string).trim());
      expect(writtenConfig.graph.provider).toBe('sqlite');
      consoleSpy.mockRestore();
    });

    it('includes version "1"', async () => {
      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      const writeFileCalls = (writeFile as Mock).mock.calls;
      const configCall = writeFileCalls.find((call: unknown[]) =>
        (call[0] as string).endsWith('config.json'),
      );
      const writtenConfig = JSON.parse((configCall![1] as string).trim());
      expect(writtenConfig.version).toBe('1');
      consoleSpy.mockRestore();
    });

    it('includes default governance excluded_patterns', async () => {
      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      const writeFileCalls = (writeFile as Mock).mock.calls;
      const configCall = writeFileCalls.find((call: unknown[]) =>
        (call[0] as string).endsWith('config.json'),
      );
      const writtenConfig = JSON.parse((configCall![1] as string).trim());
      expect(writtenConfig.governance.excluded_patterns).toContain('node_modules/**');
      consoleSpy.mockRestore();
    });

    it('includes git and documentation collectors', async () => {
      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      const writeFileCalls = (writeFile as Mock).mock.calls;
      const configCall = writeFileCalls.find((call: unknown[]) =>
        (call[0] as string).endsWith('config.json'),
      );
      const writtenConfig = JSON.parse((configCall![1] as string).trim());
      const collectorTypes = writtenConfig.collectors.map(
        (c: { type: string }) => c.type,
      );
      expect(collectorTypes).toContain('git');
      expect(collectorTypes).toContain('documentation');
      consoleSpy.mockRestore();
    });
  });
});
