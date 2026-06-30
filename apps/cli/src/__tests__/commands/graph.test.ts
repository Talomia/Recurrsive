/**
 * Unit tests for the `recurrsive graph` command.
 *
 * Tests cover:
 * - `graph --stats` shows entity/relationship counts
 * - `graph --type <type>` lists entities by type
 * - `graph --search <pattern>` finds entities by name
 * - `graph --neighbors <id>` shows entity neighbors
 * - Error handling when graph is not initialized
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock external dependencies
// ---------------------------------------------------------------------------

// vi.hoisted runs before vi.mock hoisting, so these are available in factories
const {
  mockGetStats,
  mockGetEntities,
  mockGetEntity,
  mockGetNeighbors,
  mockDispose,
} = vi.hoisted(() => ({
  mockGetStats: vi.fn(),
  mockGetEntities: vi.fn(),
  mockGetEntity: vi.fn(),
  mockGetNeighbors: vi.fn(),
  mockDispose: vi.fn(),
}));

vi.mock('../../config/loader.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('@recurrsive/graph', () => ({
  createGraphClient: vi.fn().mockResolvedValue({
    getStats: mockGetStats,
    getEntities: mockGetEntities,
    getEntity: mockGetEntity,
    getNeighbors: mockGetNeighbors,
    dispose: mockDispose,
  }),
}));

vi.mock('../../output/terminal.js', () => ({
  header: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  bold: vi.fn((t: string) => t),
  cyan: vi.fn((t: string) => t),
  dim: vi.fn((t: string) => t),
  magenta: vi.fn((t: string) => t),
  table: vi.fn((_headers: string[], _rows: string[][]) => '<table>'),
  progressBar: vi.fn((_val: number, _max: number, _w: number) => '[████████]'),
}));

import { loadConfig } from '../../config/loader.js';
import { createGraphClient } from '@recurrsive/graph';
import { registerGraphCommand } from '../../commands/graph.js';
import {
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

/** Sample graph stats. */
const sampleStats = {
  totalEntities: 42,
  totalRelationships: 128,
  entityCountsByType: {
    file: 20,
    function: 15,
    class: 7,
  },
  relationshipCountsByType: {
    IMPORTS: 50,
    CONTAINS: 40,
    CALLS: 38,
  },
};

/** Sample entity list. */
const sampleEntities = [
  {
    id: 'aaaa-bbbb-cccc-dddd',
    name: 'UserService',
    type: 'class',
    qualified_name: 'src/services/UserService.ts::UserService',
    source: 'src/services/UserService.ts',
  },
  {
    id: 'eeee-ffff-0000-1111',
    name: 'AuthController',
    type: 'class',
    qualified_name: 'src/controllers/AuthController.ts::AuthController',
    source: 'src/controllers/AuthController.ts',
  },
];

/**
 * Create a fake Commander program that captures the action handler
 * for the `graph` command.
 */
function createFakeProgram() {
  let actionHandler: ((opts: Record<string, unknown>) => Promise<void>) | null = null;

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

  registerGraphCommand(program as any);

  return {
    program,
    commandChain,
    runAction: (opts: {
      stats?: boolean;
      type?: string;
      search?: string;
      neighbors?: string;
      depth?: number;
    } = {}) => {
      if (!actionHandler) throw new Error('action not registered');
      return actionHandler(opts);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerGraphCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (loadConfig as Mock).mockResolvedValue(defaultConfigResult);
    mockGetStats.mockResolvedValue(sampleStats);
    mockGetEntities.mockResolvedValue(sampleEntities);
    mockGetEntity.mockResolvedValue(null);
    mockGetNeighbors.mockResolvedValue({ entities: [], relationships: [] });
    mockDispose.mockResolvedValue(undefined);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // ── Command Registration ───────────────────────────────────────────────

  describe('command registration', () => {
    it('registers the "graph" command', () => {
      const { program } = createFakeProgram();
      expect(program.command).toHaveBeenCalledWith('graph');
    });

    it('has --stats, --type, --search, and --neighbors options', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.option).toHaveBeenCalledWith(
        '--stats',
        'Show entity/relationship counts by type',
      );
      expect(commandChain.option).toHaveBeenCalledWith(
        '--type <entityType>',
        'List entities of a specific type',
      );
      expect(commandChain.option).toHaveBeenCalledWith(
        '--search <pattern>',
        'Search entities by name',
      );
    });
  });

  // ── graph --stats ──────────────────────────────────────────────────────

  describe('graph --stats', () => {
    it('shows entity and relationship counts', async () => {
      const { runAction } = createFakeProgram();
      await runAction({ stats: true });

      expect(header).toHaveBeenCalledWith('Knowledge Graph Statistics');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('42'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('128'),
      );
    });

    it('displays entity counts by type as a table', async () => {
      const { runAction } = createFakeProgram();
      await runAction({ stats: true });

      expect(table).toHaveBeenCalledWith(
        ['Type', 'Count', 'Distribution'],
        expect.any(Array),
      );
    });

    it('displays relationship counts by type as a table', async () => {
      const { runAction } = createFakeProgram();
      await runAction({ stats: true });

      expect(table).toHaveBeenCalledWith(
        ['Type', 'Count'],
        expect.any(Array),
      );
    });

    it('defaults to --stats when no options given', async () => {
      const { runAction } = createFakeProgram();
      await runAction({});

      expect(header).toHaveBeenCalledWith('Knowledge Graph Statistics');
      expect(mockGetStats).toHaveBeenCalled();
    });

    it('handles empty entity/relationship types', async () => {
      mockGetStats.mockResolvedValue({
        totalEntities: 0,
        totalRelationships: 0,
        entityCountsByType: {},
        relationshipCountsByType: {},
      });

      const { runAction } = createFakeProgram();
      await runAction({ stats: true });

      expect(header).toHaveBeenCalledWith('Knowledge Graph Statistics');
      // Should still show totals even if zero
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('0'),
      );
    });
  });

  // ── graph --type ───────────────────────────────────────────────────────

  describe('graph --type', () => {
    it('lists entities by type', async () => {
      const { runAction } = createFakeProgram();
      await runAction({ type: 'class' });

      expect(header).toHaveBeenCalledWith('Entities: class');
      expect(mockGetEntities).toHaveBeenCalledWith('class');
      expect(table).toHaveBeenCalledWith(
        ['Name', 'Qualified Name', 'Source', 'ID'],
        expect.any(Array),
      );
    });

    it('shows info when no entities of given type', async () => {
      mockGetEntities.mockResolvedValue([]);

      const { runAction } = createFakeProgram();
      await runAction({ type: 'endpoint' });

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('No entities of type "endpoint"'),
      );
    });
  });

  // ── graph --search ─────────────────────────────────────────────────────

  describe('graph --search', () => {
    it('finds entities by name (case-insensitive)', async () => {
      const { runAction } = createFakeProgram();
      await runAction({ search: 'user' });

      // Should call getEntities for each entity type
      expect(mockGetEntities).toHaveBeenCalled();
      expect(table).toHaveBeenCalledWith(
        ['Name', 'Type', 'Qualified Name', 'ID'],
        expect.any(Array),
      );
    });

    it('shows info when no matches found', async () => {
      mockGetEntities.mockResolvedValue([]);

      const { runAction } = createFakeProgram();
      await runAction({ search: 'nonexistent' });

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('No entities matching "nonexistent"'),
      );
    });

    it('shows match count', async () => {
      const { runAction } = createFakeProgram();
      await runAction({ search: 'Service' });

      // Only UserService matches "Service"
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('1'),
      );
    });
  });

  // ── graph --neighbors ──────────────────────────────────────────────────

  describe('graph --neighbors', () => {
    it('shows entity detail and neighbors', async () => {
      const entity = sampleEntities[0]!;
      mockGetEntity.mockResolvedValue(entity);
      mockGetNeighbors.mockResolvedValue({
        entities: [
          entity,
          {
            id: 'neighbor-1',
            name: 'AuthService',
            type: 'class',
            qualified_name: 'src/services/AuthService.ts::AuthService',
          },
        ],
        relationships: [
          {
            source_id: entity.id,
            target_id: 'neighbor-1',
            type: 'DEPENDS_ON',
          },
        ],
      });

      const { runAction } = createFakeProgram();
      await runAction({ neighbors: entity.id });

      expect(header).toHaveBeenCalledWith(
        expect.stringContaining('UserService'),
      );
      expect(mockGetEntity).toHaveBeenCalledWith(entity.id);
      expect(mockGetNeighbors).toHaveBeenCalledWith(entity.id, 1);
    });

    it('uses custom depth when specified', async () => {
      const entity = sampleEntities[0]!;
      mockGetEntity.mockResolvedValue(entity);

      const { runAction } = createFakeProgram();
      await runAction({ neighbors: entity.id, depth: 3 });

      expect(mockGetNeighbors).toHaveBeenCalledWith(entity.id, 3);
    });

    it('shows error when entity not found', async () => {
      mockGetEntity.mockResolvedValue(null);

      const { runAction } = createFakeProgram();
      await runAction({ neighbors: 'bad-id' });

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Entity not found'),
      );
    });

    it('shows info when entity has no neighbors', async () => {
      const entity = sampleEntities[0]!;
      mockGetEntity.mockResolvedValue(entity);
      mockGetNeighbors.mockResolvedValue({
        entities: [],
        relationships: [],
      });

      const { runAction } = createFakeProgram();
      await runAction({ neighbors: entity.id });

      expect(info).toHaveBeenCalledWith('No neighbors found.');
    });
  });

  // ── Error Handling ─────────────────────────────────────────────────────

  describe('error handling', () => {
    it('handles graph initialization errors', async () => {
      (createGraphClient as Mock).mockRejectedValue(
        new Error('SQLITE_CANTOPEN: unable to open database file'),
      );

      const { runAction } = createFakeProgram();
      await runAction({ stats: true });

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Graph error'),
      );
      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('recurrsive analyze'),
      );
    });

    it('disposes graph client even after errors', async () => {
      mockGetStats.mockRejectedValue(new Error('query failed'));

      // Reset createGraphClient to succeed (so client is created)
      (createGraphClient as Mock).mockResolvedValue({
        getStats: mockGetStats,
        getEntities: mockGetEntities,
        getEntity: mockGetEntity,
        getNeighbors: mockGetNeighbors,
        dispose: mockDispose,
      });

      const { runAction } = createFakeProgram();
      await runAction({ stats: true });

      expect(mockDispose).toHaveBeenCalled();
    });
  });
});
