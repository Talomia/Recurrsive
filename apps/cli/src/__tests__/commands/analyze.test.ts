/**
 * Unit tests for the `recurrsive analyze` command.
 *
 * Tests cover:
 * - Command registration with correct options
 * - Runs analysis on a valid path
 * - Shows progress steps during analysis
 * - Handles missing path argument (non-existent path)
 * - Handles --analyzers flag to run specific analyzers
 * - Error handling when analysis (runner) fails
 * - Creates graph and disposes it after analysis
 * - Handles createGraphClient failure
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock external dependencies
// ---------------------------------------------------------------------------

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(''),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config/loader.js', () => ({
  loadConfig: vi.fn(),
}));

const { makeCollectorInstance, mockGraphClient, mockRegistry, mockRunner } = vi.hoisted(() => {
  const makeCollectorInstance = () => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    validate: vi.fn().mockResolvedValue({ valid: true, errors: [] }),
    collect: vi.fn().mockResolvedValue({
      entities: [],
      relationships: [],
      metadata: { duration_ms: 100 },
    }),
    dispose: vi.fn().mockResolvedValue(undefined),
  });

  const mockGraphClient = {
    upsertEntity: vi.fn().mockResolvedValue(undefined),
    upsertRelationship: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({ totalEntities: 10, totalRelationships: 5 }),
    dispose: vi.fn().mockResolvedValue(undefined),
  };

  const mockRegistry = {
    register: vi.fn(),
  };

  const mockRunner = {
    run: vi.fn().mockResolvedValue({
      analyzers_run: ['analyzer-1'],
      analyzers_failed: [],
      findings: [],
      duration_ms: 200,
    }),
  };

  return { makeCollectorInstance, mockGraphClient, mockRegistry, mockRunner };
});

vi.mock('@recurrsive/collectors', () => ({
  GitCollector: vi.fn().mockImplementation(() => makeCollectorInstance()),
  DocumentationCollector: vi.fn().mockImplementation(() => makeCollectorInstance()),
  EnvironmentCollector: vi.fn().mockImplementation(() => makeCollectorInstance()),
  CICDCollector: vi.fn().mockImplementation(() => makeCollectorInstance()),
  DatabaseCollector: vi.fn().mockImplementation(() => makeCollectorInstance()),
}));

vi.mock('@recurrsive/parsers', () => ({
  ParsingPipeline: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    parseProject: vi.fn().mockResolvedValue({ entities: [], relationships: [] }),
  })),
}));

vi.mock('@recurrsive/graph', () => ({
  createGraphClient: vi.fn().mockResolvedValue(mockGraphClient),
}));

vi.mock('@recurrsive/analyzers', () => ({
  AnalyzerRegistry: vi.fn().mockImplementation(() => mockRegistry),
  AnalyzerRunner: vi.fn().mockImplementation(() => mockRunner),
  createDefaultAnalyzers: vi.fn().mockReturnValue([
    { id: 'architecture', analyze: vi.fn() },
    { id: 'security', analyze: vi.fn() },
  ]),
}));

vi.mock('@recurrsive/opportunities', () => ({
  OpportunityManager: vi.fn().mockImplementation(() => ({
    save: vi.fn().mockResolvedValue(undefined),
    export: vi.fn().mockReturnValue('exported'),
    count: 0,
  })),
}));

vi.mock('@recurrsive/core', () => ({
  formatDuration: vi.fn((ms: number) => `${ms}ms`),
}));

vi.mock('../../output/terminal.js', () => ({
  banner: vi.fn(),
  Spinner: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  })),
  header: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  step: vi.fn(),
  bold: vi.fn((t: string) => t),
  cyan: vi.fn((t: string) => t),
  dim: vi.fn((t: string) => t),
  green: vi.fn((t: string) => t),
  yellow: vi.fn((t: string) => t),
  red: vi.fn((t: string) => t),
  magenta: vi.fn((t: string) => t),
  table: vi.fn((_h: string[], _r: string[][]) => 'table'),
  severityColor: vi.fn((s: string) => s),
  severityBadge: vi.fn((s: string) => `[${s}]`),
}));

// ---------------------------------------------------------------------------
// Imports (AFTER mocks)
// ---------------------------------------------------------------------------

import { existsSync } from 'node:fs';
import { loadConfig } from '../../config/loader.js';
import { createGraphClient } from '@recurrsive/graph';
import { createDefaultAnalyzers } from '@recurrsive/analyzers';
import { registerAnalyzeCommand } from '../../commands/analyze.js';
import {
  banner,
  error as termError,
  step,
  success,
  warning,
} from '../../output/terminal.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default loadConfig mock return value. */
const defaultConfigResult = {
  config: {
    project: { name: 'test-project' },
    output: { directory: '.recurrsive', format: 'markdown' },
    graph: { provider: 'sqlite' as const },
    governance: {},
    reasoning: undefined,
  },
  configPath: '/project/.recurrsive/config.json',
  projectRoot: '/project',
};

/**
 * Create a fake Commander program that captures the action handler
 * for the `analyze` command.
 */
function createFakeProgram() {
  let actionHandler:
    | ((pathArg: string, opts: Record<string, unknown>) => Promise<void>)
    | null = null;

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

  registerAnalyzeCommand(program as any);

  return {
    program,
    commandChain,
    runAction: (
      pathArg: string = '.',
      opts: Record<string, unknown> = {},
    ) => {
      if (!actionHandler) throw new Error('action not registered');
      const mergedOpts = {
        format: 'markdown',
        reasoning: false,
        ...opts,
      };
      return actionHandler(pathArg, mergedOpts);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerAnalyzeCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (loadConfig as Mock).mockResolvedValue(defaultConfigResult);
    (existsSync as Mock).mockReturnValue(true);
    // Reset graph mock defaults
    (createGraphClient as Mock).mockResolvedValue(mockGraphClient);
    mockGraphClient.dispose.mockResolvedValue(undefined);
    mockRunner.run.mockResolvedValue({
      analyzers_run: ['analyzer-1'],
      analyzers_failed: [],
      findings: [],
      duration_ms: 200,
    });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  // ── Command Registration ───────────────────────────────────────────────

  describe('command registration', () => {
    it('registers the "analyze" command', () => {
      const { program } = createFakeProgram();
      expect(program.command).toHaveBeenCalledWith('analyze');
    });

    it('has --format option', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.option).toHaveBeenCalledWith(
        '--format <format>',
        expect.any(String),
        'markdown',
      );
    });

    it('has --analyzers option', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.option).toHaveBeenCalledWith(
        '--analyzers <list>',
        expect.any(String),
      );
    });

    it('has --output option', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.option).toHaveBeenCalledWith(
        '--output <path>',
        expect.any(String),
      );
    });

    it('has --no-reasoning option', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.option).toHaveBeenCalledWith(
        '--no-reasoning',
        expect.any(String),
      );
    });

    it('has --verbose option', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.option).toHaveBeenCalledWith(
        '--verbose',
        expect.any(String),
      );
    });

    it('accepts a [path] argument', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.argument).toHaveBeenCalledWith(
        '[path]',
        expect.any(String),
        '.',
      );
    });
  });

  // ── Runs Analysis ─────────────────────────────────────────────────────

  describe('runs analysis', () => {
    it('runs the full analysis pipeline on a given path', async () => {
      const { runAction } = createFakeProgram();
      await runAction('/project');

      expect(banner).toHaveBeenCalled();
      expect(loadConfig).toHaveBeenCalledWith({ cwd: expect.any(String) });
      expect(createGraphClient).toHaveBeenCalled();
      expect(success).toHaveBeenCalled();
    });

    it('calls step() for progress during analysis', async () => {
      const { runAction } = createFakeProgram();
      await runAction('/project');

      // Multiple steps should have been called
      expect(step).toHaveBeenCalledWith(1, expect.any(Number), expect.any(String));
      expect(step).toHaveBeenCalledWith(2, expect.any(Number), expect.any(String));
    });

    it('displays the project name from config', async () => {
      const { runAction } = createFakeProgram();
      await runAction('/project');

      expect(success).toHaveBeenCalledWith(
        expect.stringContaining('test-project'),
      );
    });
  });

  // ── Missing Path ──────────────────────────────────────────────────────

  describe('handles missing path', () => {
    it('shows error and exits when path does not exist', async () => {
      (existsSync as Mock).mockReturnValue(false);

      const { runAction } = createFakeProgram();
      await runAction('/nonexistent/path');

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('does not exist'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── Analyzer Filtering ────────────────────────────────────────────────

  describe('--analyzers flag', () => {
    it('filters analyzers to only specified IDs', async () => {
      const { runAction } = createFakeProgram();
      await runAction('/project', { analyzers: 'security' });

      // Only 'security' should be registered, not 'architecture'
      expect(mockRegistry.register).toHaveBeenCalledTimes(1);
      expect(mockRegistry.register).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'security' }),
      );
    });

    it('registers all analyzers when --analyzers is not specified', async () => {
      const { runAction } = createFakeProgram();
      await runAction('/project');

      // Both default analyzers should be registered
      const defaultAnalyzers = (createDefaultAnalyzers as Mock).mock.results[0]?.value;
      expect(mockRegistry.register).toHaveBeenCalledTimes(defaultAnalyzers.length);
    });
  });

  // ── Error Handling ────────────────────────────────────────────────────

  describe('error handling', () => {
    it('disposes graph client when analysis throws', async () => {
      mockRunner.run.mockRejectedValue(new Error('Analyzer crash'));

      const { runAction } = createFakeProgram();
      await expect(runAction('/project')).rejects.toThrow('Analyzer crash');

      // The catch block in the command disposes the graph client and rethrows
      expect(mockGraphClient.dispose).toHaveBeenCalled();
    });

    it('reports createGraphClient failure', async () => {
      (createGraphClient as Mock).mockRejectedValue(
        new Error('Connection refused'),
      );

      const { runAction } = createFakeProgram();
      // After process.exit is mocked, code continues and graphClient is
      // undefined, causing a TypeError in the subsequent try block.
      await expect(runAction('/project')).rejects.toThrow();

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create graph client'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('warns when some analyzers fail but does not throw', async () => {
      mockRunner.run.mockResolvedValue({
        analyzers_run: ['architecture'],
        analyzers_failed: ['security'],
        findings: [],
        duration_ms: 150,
      });

      const { runAction } = createFakeProgram();
      await runAction('/project');

      expect(warning).toHaveBeenCalledWith(
        expect.stringContaining('security'),
      );
    });
  });

  // ── Graph Lifecycle ───────────────────────────────────────────────────

  describe('graph lifecycle', () => {
    it('creates and disposes the graph client', async () => {
      const { runAction } = createFakeProgram();
      await runAction('/project');

      expect(createGraphClient).toHaveBeenCalled();
      expect(mockGraphClient.dispose).toHaveBeenCalled();
    });

    it('displays graph stats in the summary', async () => {
      const { runAction } = createFakeProgram();
      await runAction('/project');

      expect(mockGraphClient.getStats).toHaveBeenCalled();
      // The summary prints total entities and relationships
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('10'),
      );
    });
  });
});
