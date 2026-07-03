/**
 * Unit tests for the `recurrsive snapshot` command group.
 *
 * Tests cover:
 * - Command registration (snapshot export, snapshot import)
 * - Export generates valid JSON file with correct structure
 * - Export with --output flag
 * - Export shows stats in terminal output
 * - Import reads and upserts entities/relationships
 * - Import validates file structure
 * - Import handles missing file
 * - Import handles invalid JSON
 * - Error handling and client disposal
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock external dependencies
// ---------------------------------------------------------------------------

const {
  mockQuery,
  mockUpsertEntity,
  mockUpsertRelationship,
  mockDispose,
} = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockUpsertEntity: vi.fn(),
  mockUpsertRelationship: vi.fn(),
  mockDispose: vi.fn(),
}));

vi.mock('../../config/loader.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('@recurrsive/graph', () => ({
  createGraphClient: vi.fn().mockResolvedValue({
    query: mockQuery,
    upsertEntity: mockUpsertEntity,
    upsertRelationship: mockUpsertRelationship,
    dispose: mockDispose,
  }),
}));

vi.mock('../../output/terminal.js', () => ({
  banner: vi.fn(),
  header: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  bold: vi.fn((t: string) => t),
  cyan: vi.fn((t: string) => t),
  dim: vi.fn((t: string) => t),
  table: vi.fn((_headers: string[], _rows: string[][]) => '<table>'),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { loadConfig } from '../../config/loader.js';
import { createGraphClient } from '@recurrsive/graph';
import { registerSnapshotCommand } from '../../commands/snapshot.js';
import {
  banner,
  header,
  success,
  error as termError,
  info,
  table,
} from '../../output/terminal.js';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

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

/** Sample entities for export tests. */
const sampleEntities = [
  {
    id: 'ent-001',
    name: 'UserService',
    type: 'class',
    qualified_name: 'src/services/UserService.ts::UserService',
    description: 'Handles user management',
    source: 'src/services/UserService.ts',
    properties: {},
    tags: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    last_seen_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'ent-002',
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

/** Sample relationships for export tests. */
const sampleRelationships = [
  {
    id: 'rel-001',
    type: 'calls',
    source_id: 'ent-002',
    target_id: 'ent-001',
    properties: {},
    confidence: 1,
    source: 'static_analysis',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

/** A valid snapshot object for import tests. */
const validSnapshot = {
  version: '0.5.5',
  exported_at: '2026-06-30T12:00:00Z',
  project: 'test-project',
  entities: sampleEntities,
  relationships: sampleRelationships,
  stats: {
    entity_count: 2,
    relationship_count: 1,
    entity_types: { class: 1, function: 1 },
  },
};

/**
 * Create a fake Commander program that captures the sub-command action handlers
 * for `snapshot export` and `snapshot import`.
 */
function createFakeProgram() {
  let exportHandler: ((opts: Record<string, unknown>) => Promise<void>) | null =
    null;
  let importHandler:
    | ((file: string, opts: Record<string, unknown>) => Promise<void>)
    | null = null;

  const exportChain = {
    description: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    action: vi.fn((fn: typeof exportHandler) => {
      exportHandler = fn;
      return exportChain;
    }),
  };

  const importChain = {
    description: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    action: vi.fn((fn: typeof importHandler) => {
      importHandler = fn;
      return importChain;
    }),
  };

  const snapshotChain = {
    description: vi.fn().mockReturnThis(),
    command: vi.fn((name: string) => {
      if (name === 'export') return exportChain;
      if (name === 'import <file>') return importChain;
      return exportChain;
    }),
  };

  const program = {
    command: vi.fn().mockReturnValue(snapshotChain),
  };

  registerSnapshotCommand(program as any);

  return {
    program,
    snapshotChain,
    exportChain,
    importChain,
    runExport: (opts: { output?: string } = {}) => {
      if (!exportHandler) throw new Error('export action not registered');
      return exportHandler(opts);
    },
    runImport: (file: string, opts: Record<string, unknown> = {}) => {
      if (!importHandler) throw new Error('import action not registered');
      return importHandler(file, opts);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerSnapshotCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (loadConfig as Mock).mockResolvedValue(defaultConfigResult);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('entities')) return Promise.resolve(sampleEntities);
      if (sql.includes('relationships')) {
        return Promise.resolve(sampleRelationships);
      }
      return Promise.resolve([]);
    });
    mockUpsertEntity.mockImplementation((e: unknown) => Promise.resolve(e));
    mockUpsertRelationship.mockImplementation((r: unknown) =>
      Promise.resolve(r),
    );
    mockDispose.mockResolvedValue(undefined);
    (writeFile as Mock).mockResolvedValue(undefined);
    (mkdir as Mock).mockResolvedValue(undefined);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // ── Command Registration ──────────────────────────────────────────────

  describe('command registration', () => {
    it('registers the "snapshot" parent command', () => {
      const { program } = createFakeProgram();
      expect(program.command).toHaveBeenCalledWith('snapshot');
    });

    it('registers "export" sub-command', () => {
      const { snapshotChain } = createFakeProgram();
      expect(snapshotChain.command).toHaveBeenCalledWith('export');
    });

    it('registers "import <file>" sub-command', () => {
      const { snapshotChain } = createFakeProgram();
      expect(snapshotChain.command).toHaveBeenCalledWith('import <file>');
    });

    it('export has --output option', () => {
      const { exportChain } = createFakeProgram();
      expect(exportChain.option).toHaveBeenCalledWith(
        '--output <path>',
        'Output file path',
      );
    });
  });

  // ── Snapshot Export ────────────────────────────────────────────────────

  describe('snapshot export', () => {
    it('queries all entities and relationships', async () => {
      const { runExport } = createFakeProgram();
      await runExport();

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM entities');
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM relationships');
    });

    it('generates valid JSON file', async () => {
      const { runExport } = createFakeProgram();
      await runExport();

      expect(writeFile).toHaveBeenCalledTimes(1);
      const [, content] = (writeFile as Mock).mock.calls[0];
      const parsed = JSON.parse(content);
      expect(parsed.version).toBe('0.5.5');
      expect(parsed.entities).toEqual(sampleEntities);
      expect(parsed.relationships).toEqual(sampleRelationships);
      expect(parsed.stats.entity_count).toBe(2);
      expect(parsed.stats.relationship_count).toBe(1);
    });

    it('includes entity_types breakdown in stats', async () => {
      const { runExport } = createFakeProgram();
      await runExport();

      const [, content] = (writeFile as Mock).mock.calls[0];
      const parsed = JSON.parse(content);
      expect(parsed.stats.entity_types).toEqual({
        class: 1,
        function: 1,
      });
    });

    it('uses default filename when no --output given', async () => {
      const { runExport } = createFakeProgram();
      await runExport();

      const [filePath] = (writeFile as Mock).mock.calls[0];
      expect(filePath).toMatch(/recurrsive-snapshot-\d{4}-\d{2}-\d{2}\.json$/);
    });

    it('respects --output flag', async () => {
      const { runExport } = createFakeProgram();
      await runExport({ output: '/tmp/my-snapshot.json' });

      const [filePath] = (writeFile as Mock).mock.calls[0];
      expect(filePath).toBe('/tmp/my-snapshot.json');
    });

    it('displays header and stats', async () => {
      const { runExport } = createFakeProgram();
      await runExport();

      expect(banner).toHaveBeenCalled();
      expect(header).toHaveBeenCalledWith('Snapshot Export');
      expect(table).toHaveBeenCalledWith(
        ['Entity Type', 'Count'],
        expect.any(Array),
      );
      expect(success).toHaveBeenCalledWith(
        expect.stringContaining('Snapshot saved'),
      );
    });

    it('shows error when graph is empty', async () => {
      mockQuery.mockResolvedValue([]);

      const { runExport } = createFakeProgram();
      await runExport();

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('No data found'),
      );
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('disposes client after export', async () => {
      const { runExport } = createFakeProgram();
      await runExport();

      expect(mockDispose).toHaveBeenCalled();
    });

    it('disposes client even on error', async () => {
      mockQuery.mockRejectedValue(new Error('db failure'));

      const { runExport } = createFakeProgram();
      await runExport();

      expect(mockDispose).toHaveBeenCalled();
    });
  });

  // ── Snapshot Import ────────────────────────────────────────────────────

  describe('snapshot import', () => {
    beforeEach(() => {
      (existsSync as Mock).mockReturnValue(true);
      (readFile as Mock).mockResolvedValue(JSON.stringify(validSnapshot));
    });

    it('reads and upserts all entities', async () => {
      const { runImport } = createFakeProgram();
      await runImport('/tmp/snapshot.json');

      expect(mockUpsertEntity).toHaveBeenCalledTimes(2);
      expect(mockUpsertEntity).toHaveBeenCalledWith(sampleEntities[0]);
      expect(mockUpsertEntity).toHaveBeenCalledWith(sampleEntities[1]);
    });

    it('reads and upserts all relationships', async () => {
      const { runImport } = createFakeProgram();
      await runImport('/tmp/snapshot.json');

      expect(mockUpsertRelationship).toHaveBeenCalledTimes(1);
      expect(mockUpsertRelationship).toHaveBeenCalledWith(
        sampleRelationships[0],
      );
    });

    it('displays import stats', async () => {
      const { runImport } = createFakeProgram();
      await runImport('/tmp/snapshot.json');

      expect(success).toHaveBeenCalledWith(
        expect.stringContaining('imported successfully'),
      );
    });

    it('shows snapshot version info', async () => {
      const { runImport } = createFakeProgram();
      await runImport('/tmp/snapshot.json');

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('0.5.5'),
      );
    });

    it('validates file structure — rejects missing version', async () => {
      const badSnapshot = { entities: [], relationships: [] };
      (readFile as Mock).mockResolvedValue(JSON.stringify(badSnapshot));

      const { runImport } = createFakeProgram();
      await runImport('/tmp/bad.json');

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid snapshot format'),
      );
      expect(mockUpsertEntity).not.toHaveBeenCalled();
    });

    it('validates file structure — rejects missing entities', async () => {
      const badSnapshot = { version: '0.5.5', relationships: [] };
      (readFile as Mock).mockResolvedValue(JSON.stringify(badSnapshot));

      const { runImport } = createFakeProgram();
      await runImport('/tmp/bad.json');

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid snapshot format'),
      );
    });

    it('validates file structure — rejects missing relationships', async () => {
      const badSnapshot = { version: '0.5.5', entities: [] };
      (readFile as Mock).mockResolvedValue(JSON.stringify(badSnapshot));

      const { runImport } = createFakeProgram();
      await runImport('/tmp/bad.json');

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid snapshot format'),
      );
    });

    it('handles missing file', async () => {
      (existsSync as Mock).mockReturnValue(false);

      const { runImport } = createFakeProgram();
      await runImport('/tmp/nonexistent.json');

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Snapshot file not found'),
      );
      expect(mockUpsertEntity).not.toHaveBeenCalled();
    });

    it('handles invalid JSON', async () => {
      (readFile as Mock).mockResolvedValue('{ not valid json !!!');

      const { runImport } = createFakeProgram();
      await runImport('/tmp/corrupt.json');

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid JSON'),
      );
      expect(mockUpsertEntity).not.toHaveBeenCalled();
    });

    it('disposes client after import', async () => {
      const { runImport } = createFakeProgram();
      await runImport('/tmp/snapshot.json');

      expect(mockDispose).toHaveBeenCalled();
    });

    it('disposes client even on upsert error', async () => {
      mockUpsertEntity.mockRejectedValue(new Error('upsert failed'));

      const { runImport } = createFakeProgram();
      await runImport('/tmp/snapshot.json');

      expect(mockDispose).toHaveBeenCalled();
    });
  });

  // ── Error Handling ────────────────────────────────────────────────────

  describe('error handling', () => {
    it('handles graph initialization errors on export', async () => {
      (createGraphClient as Mock).mockRejectedValue(
        new Error('SQLITE_CANTOPEN'),
      );

      const { runExport } = createFakeProgram();
      await runExport();

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Export failed'),
      );
    });

    it('handles graph initialization errors on import', async () => {
      (existsSync as Mock).mockReturnValue(true);
      (readFile as Mock).mockResolvedValue(JSON.stringify(validSnapshot));
      (createGraphClient as Mock).mockRejectedValue(
        new Error('SQLITE_CANTOPEN'),
      );

      const { runImport } = createFakeProgram();
      await runImport('/tmp/snapshot.json');

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Import failed'),
      );
    });
  });
});
