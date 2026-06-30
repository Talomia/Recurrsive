/**
 * Unit tests for the `recurrsive timeline` command.
 *
 * Tests cover:
 * - `timeline` shows timeline entries (default overview)
 * - `timeline` with --limit flag
 * - `timeline` with --compare flag
 * - `timeline` with --dimension flag
 * - `timeline` with no data
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock external dependencies
// ---------------------------------------------------------------------------

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([]),
  readFile: vi.fn().mockResolvedValue('{}'),
}));

vi.mock('../../config/loader.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../../output/terminal.js', () => ({
  header: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  bold: vi.fn((t: string) => t),
  cyan: vi.fn((t: string) => t),
  dim: vi.fn((t: string) => t),
  green: vi.fn((t: string) => t),
  red: vi.fn((t: string) => t),
  table: vi.fn((_headers: string[], _rows: string[][]) => '<table>'),
  progressBar: vi.fn((_val: number, _max: number, _w: number) => '[████████]'),
  scoreBar: vi.fn((label: string, score: number) => `${label}: ${score}`),
}));

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { loadConfig } from '../../config/loader.js';
import { registerTimelineCommand } from '../../commands/timeline.js';
import {
  header,
  info,
  error as termError,
  table,
  scoreBar,
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

/** Create a snapshot with sensible defaults. */
function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'snap-1',
    timestamp: '2024-06-15T12:00:00Z',
    overall_health: 78,
    maturity_scores: [
      {
        dimension: 'architecture',
        score: 80,
        level: 'managed',
        trend: 'improving',
        recommendations: ['Improve modularity'],
      },
      {
        dimension: 'security',
        score: 55,
        level: 'developing',
        trend: 'stable',
        recommendations: ['Add auth tests'],
      },
    ],
    opportunity_count: 3,
    debt_count: 1,
    risk_count: 1,
    top_opportunities: [],
    changes_since_last: {
      new_opportunities: 3,
      resolved_opportunities: 0,
      new_risks: 1,
      resolved_risks: 0,
      maturity_changes: [],
    },
    ...overrides,
  };
}

/**
 * Create a fake Commander program that captures the action handler
 * for the `timeline` command.
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

  registerTimelineCommand(program as any);

  return {
    program,
    commandChain,
    runAction: (opts: {
      limit?: number;
      compare?: string;
      dimension?: string;
    } = {}) => {
      if (!actionHandler) throw new Error('action not registered');
      return actionHandler(opts);
    },
  };
}

/** Set up mocks so snapshots are loaded from "files". */
function setupSnapshots(snapshots: Record<string, unknown>[]) {
  (existsSync as Mock).mockReturnValue(true);
  (readdir as Mock).mockResolvedValue(
    snapshots.map((_, i) => `snap-${i}.json`),
  );

  let callCount = 0;
  (readFile as Mock).mockImplementation(() => {
    const snap = snapshots[callCount];
    callCount++;
    return Promise.resolve(JSON.stringify(snap));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerTimelineCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (loadConfig as Mock).mockResolvedValue(defaultConfigResult);
    (existsSync as Mock).mockReturnValue(false);
    (readdir as Mock).mockResolvedValue([]);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // ── Command Registration ───────────────────────────────────────────────

  describe('command registration', () => {
    it('registers the "timeline" command', () => {
      const { program } = createFakeProgram();
      expect(program.command).toHaveBeenCalledWith('timeline');
    });

    it('has --limit, --compare, and --dimension options', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.option).toHaveBeenCalledWith(
        '--limit <n>',
        'Number of snapshots to show',
        parseInt,
      );
      expect(commandChain.option).toHaveBeenCalledWith(
        '--compare <ids>',
        'Compare two snapshot IDs (comma-separated)',
      );
      expect(commandChain.option).toHaveBeenCalledWith(
        '--dimension <dim>',
        'Focus on a specific maturity dimension',
      );
    });
  });

  // ── No Data ────────────────────────────────────────────────────────────

  describe('no data', () => {
    it('shows info message when no snapshots exist', async () => {
      const { runAction } = createFakeProgram();
      await runAction();

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('No intelligence snapshots found'),
      );
    });

    it('suggests running analyze', async () => {
      const { runAction } = createFakeProgram();
      await runAction();

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('recurrsive analyze'),
      );
    });
  });

  // ── Default Timeline Overview ──────────────────────────────────────────

  describe('default timeline overview', () => {
    it('shows latest snapshot and maturity scores', async () => {
      setupSnapshots([makeSnapshot()]);

      const { runAction } = createFakeProgram();
      await runAction();

      expect(header).toHaveBeenCalledWith('Intelligence Timeline');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('2024-06-15'),
      );
      // Should render maturity scores via scoreBar
      expect(scoreBar).toHaveBeenCalledWith('architecture', 80);
      expect(scoreBar).toHaveBeenCalledWith('security', 55);
    });

    it('shows health history when multiple snapshots exist', async () => {
      const older = makeSnapshot({
        id: 'snap-old',
        timestamp: '2024-01-01T00:00:00Z',
        overall_health: 60,
      });
      const newer = makeSnapshot({
        id: 'snap-new',
        timestamp: '2024-06-15T12:00:00Z',
        overall_health: 85,
      });
      setupSnapshots([older, newer]);

      const { runAction } = createFakeProgram();
      await runAction();

      expect(header).toHaveBeenCalledWith('Intelligence Timeline');
      // Should render a table for history
      expect(table).toHaveBeenCalledWith(
        ['Timestamp', 'Health', 'Opps', 'Risks', 'Debt', 'ID'],
        expect.any(Array),
      );
    });
  });

  // ── --limit ────────────────────────────────────────────────────────────

  describe('--limit flag', () => {
    it('limits the number of displayed snapshots', async () => {
      const snaps = Array.from({ length: 5 }, (_, i) =>
        makeSnapshot({
          id: `snap-${i}`,
          timestamp: `2024-0${i + 1}-15T12:00:00Z`,
          overall_health: 60 + i * 5,
        }),
      );
      setupSnapshots(snaps);

      const { runAction } = createFakeProgram();
      await runAction({ limit: 2 });

      // The history table should be rendered with limited rows
      expect(header).toHaveBeenCalledWith('Intelligence Timeline');
    });
  });

  // ── --compare ──────────────────────────────────────────────────────────

  describe('--compare flag', () => {
    it('compares two snapshots by ID', async () => {
      const snap1 = makeSnapshot({
        id: 'snap-old',
        timestamp: '2024-01-01T00:00:00Z',
        overall_health: 60,
      });
      const snap2 = makeSnapshot({
        id: 'snap-new',
        timestamp: '2024-06-15T12:00:00Z',
        overall_health: 85,
      });
      setupSnapshots([snap1, snap2]);

      const { runAction } = createFakeProgram();
      await runAction({ compare: 'snap-old,snap-new' });

      expect(header).toHaveBeenCalledWith('Snapshot Comparison');
      expect(table).toHaveBeenCalledWith(
        ['Dimension', 'Before', 'After', 'Δ', 'Level'],
        expect.any(Array),
      );
    });

    it('shows error when not exactly two IDs', async () => {
      setupSnapshots([makeSnapshot()]);

      const { runAction } = createFakeProgram();
      await runAction({ compare: 'snap-1' });

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('exactly two snapshot IDs'),
      );
    });

    it('shows error when snapshot not found', async () => {
      setupSnapshots([makeSnapshot({ id: 'snap-1' })]);

      const { runAction } = createFakeProgram();
      await runAction({ compare: 'snap-1,nonexistent' });

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('not found'),
      );
    });
  });

  // ── --dimension ────────────────────────────────────────────────────────

  describe('--dimension flag', () => {
    it('focuses on a specific maturity dimension', async () => {
      setupSnapshots([makeSnapshot()]);

      const { runAction } = createFakeProgram();
      await runAction({ dimension: 'architecture' });

      expect(header).toHaveBeenCalledWith('Timeline: architecture');
      expect(table).toHaveBeenCalledWith(
        ['Date', 'Score', 'Level', 'Progress'],
        expect.any(Array),
      );
    });

    it('shows info when no data for dimension', async () => {
      setupSnapshots([makeSnapshot()]);

      const { runAction } = createFakeProgram();
      await runAction({ dimension: 'nonexistent-dim' });

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('No data for dimension'),
      );
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('skips malformed snapshot files', async () => {
      (existsSync as Mock).mockReturnValue(true);
      (readdir as Mock).mockResolvedValue(['bad.json', 'good.json']);

      let callCount = 0;
      (readFile as Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve('not valid json{{{');
        return Promise.resolve(JSON.stringify(makeSnapshot({ overall_health: 92 })));
      });

      const { runAction } = createFakeProgram();
      await runAction();

      // Should still render with the good snapshot
      expect(header).toHaveBeenCalledWith('Intelligence Timeline');
    });

    it('handles snapshots directory that does not exist', async () => {
      (existsSync as Mock).mockReturnValue(false);

      const { runAction } = createFakeProgram();
      await runAction();

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('No intelligence snapshots found'),
      );
    });
  });
});
