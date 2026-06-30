/**
 * Unit tests for the `recurrsive search` command.
 *
 * Tests cover:
 * - Command registration with correct name and options
 * - Searches with query and displays results in table format
 * - Filters by --type
 * - Limits with --limit
 * - JSON output with --json
 * - Empty results message
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock external dependencies
// ---------------------------------------------------------------------------

const {
  mockSearchEntities,
  mockDispose,
} = vi.hoisted(() => ({
  mockSearchEntities: vi.fn(),
  mockDispose: vi.fn(),
}));

vi.mock('../../config/loader.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('@recurrsive/graph', () => ({
  createGraphClient: vi.fn().mockResolvedValue({
    searchEntities: mockSearchEntities,
    dispose: mockDispose,
  }),
  SqliteGraphClient: class SqliteGraphClient {},
}));

vi.mock('../../output/terminal.js', () => ({
  banner: vi.fn(),
  header: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  bold: vi.fn((t: string) => t),
  cyan: vi.fn((t: string) => t),
  dim: vi.fn((t: string) => t),
  table: vi.fn((_headers: string[], _rows: string[][]) => '<table>'),
}));

import { loadConfig } from '../../config/loader.js';
import { createGraphClient } from '@recurrsive/graph';
import { registerSearchCommand } from '../../commands/search.js';
import {
  banner,
  header,
  error as termError,
  info,
  table,
} from '../../output/terminal.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default loadConfig mock return value. */
const defaultConfigResult = {
  config: {
    output: { directory: '.recurrsive' },
    graph: { provider: 'sqlite' as const },
  },
  configPath: '/project/.recurrsive/config.json',
  projectRoot: '/project',
};

/** Sample search results. */
const sampleResults = [
  {
    id: 'aaaa-bbbb-cccc-dddd',
    name: 'UserService',
    type: 'class',
    qualified_name: 'src/services/UserService.ts::UserService',
    description: 'Handles user management and authentication',
    source: 'src/services/UserService.ts',
    properties: {},
    tags: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    last_seen_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'eeee-ffff-0000-1111',
    name: 'AuthController',
    type: 'function',
    qualified_name: 'src/controllers/AuthController.ts::AuthController',
    description: 'REST controller for auth endpoints',
    source: 'src/controllers/AuthController.ts',
    properties: {},
    tags: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    last_seen_at: '2026-01-01T00:00:00Z',
  },
];

/**
 * Create a fake Commander program that captures the action handler
 * for the `search` command.
 */
function createFakeProgram() {
  let actionHandler: ((query: string, opts: Record<string, unknown>) => Promise<void>) | null = null;

  const commandChain = {
    description: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    action: vi.fn((fn: typeof actionHandler) => {
      actionHandler = fn;
      return commandChain;
    }),
  };

  const program = {
    command: vi.fn().mockReturnValue(commandChain),
  };

  registerSearchCommand(program as any);

  return {
    program,
    commandChain,
    runAction: (
      query: string,
      opts: {
        type?: string;
        limit?: number;
        json?: boolean;
      } = {},
    ) => {
      if (!actionHandler) throw new Error('action not registered');
      return actionHandler(query, opts);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerSearchCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (loadConfig as Mock).mockResolvedValue(defaultConfigResult);
    mockSearchEntities.mockResolvedValue(sampleResults);
    mockDispose.mockResolvedValue(undefined);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // ── Command Registration ───────────────────────────────────────────────

  describe('command registration', () => {
    it('registers the "search" command with a query argument', () => {
      const { program } = createFakeProgram();
      expect(program.command).toHaveBeenCalledWith('search <query>');
    });

    it('has --type, --limit, and --json options', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.option).toHaveBeenCalledWith(
        '--type <entityType>',
        'Filter results by entity type',
      );
      expect(commandChain.option).toHaveBeenCalledWith(
        '--limit <number>',
        'Maximum number of results',
        parseInt,
      );
      expect(commandChain.option).toHaveBeenCalledWith(
        '--json',
        'Output results as JSON',
      );
    });
  });

  // ── Search with results ────────────────────────────────────────────────

  describe('search with results', () => {
    it('calls searchEntities with query and default limit', async () => {
      const { runAction } = createFakeProgram();
      await runAction('auth');

      expect(mockSearchEntities).toHaveBeenCalledWith('auth', {
        type: undefined,
        limit: 20,
      });
    });

    it('displays header with search query', async () => {
      const { runAction } = createFakeProgram();
      await runAction('auth');

      expect(banner).toHaveBeenCalled();
      expect(header).toHaveBeenCalledWith('Search: "auth"');
    });

    it('displays results in a table', async () => {
      const { runAction } = createFakeProgram();
      await runAction('auth');

      expect(table).toHaveBeenCalledWith(
        ['Name', 'Type', 'Qualified Name', 'Description'],
        expect.any(Array),
      );
    });

    it('shows result count', async () => {
      const { runAction } = createFakeProgram();
      await runAction('auth');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('2'),
      );
    });
  });

  // ── Filter by type ─────────────────────────────────────────────────────

  describe('--type filter', () => {
    it('passes type to searchEntities', async () => {
      const { runAction } = createFakeProgram();
      await runAction('auth', { type: 'function' });

      expect(mockSearchEntities).toHaveBeenCalledWith('auth', {
        type: 'function',
        limit: 20,
      });
    });

    it('shows type filter info', async () => {
      const { runAction } = createFakeProgram();
      await runAction('auth', { type: 'function' });

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('function'),
      );
    });
  });

  // ── Limit ──────────────────────────────────────────────────────────────

  describe('--limit', () => {
    it('passes custom limit to searchEntities', async () => {
      const { runAction } = createFakeProgram();
      await runAction('auth', { limit: 5 });

      expect(mockSearchEntities).toHaveBeenCalledWith('auth', {
        type: undefined,
        limit: 5,
      });
    });
  });

  // ── JSON output ────────────────────────────────────────────────────────

  describe('--json output', () => {
    it('outputs JSON and skips table formatting', async () => {
      const { runAction } = createFakeProgram();
      await runAction('auth', { json: true });

      expect(consoleSpy).toHaveBeenCalledWith(
        JSON.stringify(sampleResults, null, 2),
      );
      // Table and banner should NOT be called for JSON output
      expect(banner).not.toHaveBeenCalled();
      expect(header).not.toHaveBeenCalled();
      expect(table).not.toHaveBeenCalled();
    });
  });

  // ── Empty results ──────────────────────────────────────────────────────

  describe('empty results', () => {
    it('shows info message when no results found', async () => {
      mockSearchEntities.mockResolvedValue([]);

      const { runAction } = createFakeProgram();
      await runAction('nonexistent');

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('No results found for "nonexistent"'),
      );
    });

    it('does not render table when no results found', async () => {
      mockSearchEntities.mockResolvedValue([]);

      const { runAction } = createFakeProgram();
      await runAction('nonexistent');

      expect(table).not.toHaveBeenCalled();
    });
  });

  // ── Error Handling ─────────────────────────────────────────────────────

  describe('error handling', () => {
    it('handles graph initialization errors', async () => {
      (createGraphClient as Mock).mockRejectedValue(
        new Error('SQLITE_CANTOPEN: unable to open database file'),
      );

      const { runAction } = createFakeProgram();
      await runAction('auth');

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Search error'),
      );
      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('recurrsive analyze'),
      );
    });

    it('handles searchEntities errors', async () => {
      // Reset createGraphClient to succeed
      (createGraphClient as Mock).mockResolvedValue({
        searchEntities: mockSearchEntities,
        dispose: mockDispose,
      });
      mockSearchEntities.mockRejectedValue(new Error('FTS query failed'));

      const { runAction } = createFakeProgram();
      await runAction('bad query');

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Search error'),
      );
    });

    it('disposes graph client even after errors', async () => {
      // Reset createGraphClient to succeed
      (createGraphClient as Mock).mockResolvedValue({
        searchEntities: mockSearchEntities,
        dispose: mockDispose,
      });
      mockSearchEntities.mockRejectedValue(new Error('query failed'));

      const { runAction } = createFakeProgram();
      await runAction('auth');

      expect(mockDispose).toHaveBeenCalled();
    });
  });
});
