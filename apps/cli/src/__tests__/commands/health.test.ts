/**
 * Unit tests for the `recurrsive health` command.
 *
 * Tests cover:
 * - Renders the health score from a snapshot
 * - Renders the maturity breakdown from snapshot data
 * - Keeps health unavailable when no recorded analysis exists
 * - Handles no data at all (no config / no snapshot)
 * - JSON output mode
 * - Opportunity filtering by type (risk, debt, opportunity)
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

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

vi.mock('@recurrsive/opportunities', () => ({
  OpportunityManager: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockReturnValue([]),
  })),
}));

vi.mock('@recurrsive/graph', () => ({
  createGraphClient: vi.fn().mockResolvedValue({
    getStats: vi.fn().mockResolvedValue({ totalEntities: 0, totalRelationships: 0 }),
    dispose: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../../output/terminal.js', () => ({
  header: vi.fn(),
  info: vi.fn(),
  banner: vi.fn(),
  bold: vi.fn((t: string) => t),
  cyan: vi.fn((t: string) => t),
  dim: vi.fn((t: string) => t),
  green: vi.fn((t: string) => t),
  yellow: vi.fn((t: string) => t),
  red: vi.fn((t: string) => t),
  magenta: vi.fn((t: string) => t),
  progressBar: vi.fn((_val: number, _max: number, _w: number) => '[████████]'),
  scoreBar: vi.fn((label: string, score: number) => `${label}: ${score}`),
  severityBadge: vi.fn((s: string) => `[${s}]`),
  severityColor: vi.fn((s: string) => s),
}));

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { loadConfig } from '../../config/loader.js';
import { registerHealthCommand } from '../../commands/health.js';
import { info, header, banner, progressBar, scoreBar } from '../../output/terminal.js';

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

/** A minimal snapshot that satisfies EvolutionSnapshot shape. */
function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'snap-1',
    timestamp: '2024-01-15T12:00:00Z',
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
        score: 35,
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

/** A minimal Opportunity-like object for testing filters. */
function makeOpportunity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'opp-1',
    title: 'Test Opportunity',
    type: 'opportunity',
    category: 'architecture',
    severity: 'medium',
    confidence: 0.8,
    status: 'proposed',
    problem: 'A problem',
    recommendation: 'Fix it',
    effort: { t_shirt: 's' },
    risk: { level: 'low' },
    expected_impact: { summary: 'Good impact' },
    ...overrides,
  };
}

/**
 * Create a fake Commander program that captures the action handler
 * for the `health` command.
 */
function createFakeProgram() {
  let actionHandler: ((opts: { json?: boolean }) => Promise<void>) | null = null;

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

  registerHealthCommand(program as any);

  return {
    program,
    commandChain,
    runAction: (opts: { json?: boolean } = {}) => {
      if (!actionHandler) throw new Error('action not registered');
      return actionHandler(opts);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerHealthCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (loadConfig as Mock).mockResolvedValue(defaultConfigResult);
    (existsSync as Mock).mockReturnValue(false);
    (readdir as Mock).mockResolvedValue([]);
  });

  // ── Command Registration ───────────────────────────────────────────────

  describe('command registration', () => {
    it('registers the "health" command', () => {
      const { program } = createFakeProgram();
      expect(program.command).toHaveBeenCalledWith('health');
    });

    it('has --json option', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.option).toHaveBeenCalledWith('--json', 'Output as JSON');
    });
  });

  // ── Health Score Rendering ─────────────────────────────────────────────

  describe('health score rendering', () => {
    it('renders the overall health score from a snapshot', async () => {
      // Set up snapshot — existsSync must return true for snapshots dir
      (existsSync as Mock).mockReturnValue(true);
      (readdir as Mock).mockResolvedValue(['snap-1.json']);
      (readFile as Mock).mockResolvedValue(JSON.stringify(makeSnapshot()));

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      // progressBar should be called with the snapshot's health score
      expect(progressBar).toHaveBeenCalledWith(78, 100, 40);
      consoleSpy.mockRestore();
    });

    it('does not invent a health score when no analysis exists', async () => {
      // No snapshots, no graph
      (existsSync as Mock).mockReturnValue(false);
      (readdir as Mock).mockResolvedValue([]);

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      expect(progressBar).not.toHaveBeenCalled();
      expect(info).toHaveBeenCalledWith(expect.stringContaining('No recorded analysis results'));
      consoleSpy.mockRestore();
    });

    it('calls banner() before rendering', async () => {
      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      expect(banner).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ── Maturity Breakdown ─────────────────────────────────────────────────

  describe('maturity breakdown', () => {
    it('renders maturity scores when snapshot has them', async () => {
      (existsSync as Mock).mockReturnValue(true);
      (readdir as Mock).mockResolvedValue(['snap.json']);
      (readFile as Mock).mockResolvedValue(JSON.stringify(makeSnapshot()));

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      // header should be called with 'Maturity by Dimension'
      expect(header).toHaveBeenCalledWith('Maturity by Dimension');
      // scoreBar should be called for each dimension
      expect(scoreBar).toHaveBeenCalledWith('architecture', 80);
      expect(scoreBar).toHaveBeenCalledWith('security', 35);
      consoleSpy.mockRestore();
    });

    it('shows info message when no maturity data available', async () => {
      // No snapshots at all
      (existsSync as Mock).mockReturnValue(false);
      (readdir as Mock).mockResolvedValue([]);

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('No recorded analysis results'),
      );
      consoleSpy.mockRestore();
    });

    it('does not render maturity section when snapshot has empty maturity_scores', async () => {
      (existsSync as Mock).mockImplementation((path: string) => path.includes('snapshots'));
      (readdir as Mock).mockResolvedValue(['snap.json']);
      (readFile as Mock).mockResolvedValue(
        JSON.stringify(makeSnapshot({ maturity_scores: [] })),
      );

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('No maturity data available'),
      );
      consoleSpy.mockRestore();
    });
  });

  // ── Handles No Data Gracefully ─────────────────────────────────────────

  describe('handles no data gracefully', () => {
    it('does not crash when there are no snapshots and no opportunities', async () => {
      (existsSync as Mock).mockReturnValue(false);

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await expect(runAction()).resolves.not.toThrow();
      consoleSpy.mockRestore();
    });

    it('does not render risks section when there are none', async () => {
      (existsSync as Mock).mockReturnValue(false);

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      expect(header).not.toHaveBeenCalledWith('Top Risks');
      consoleSpy.mockRestore();
    });

    it('does not render opportunities section when there are none', async () => {
      (existsSync as Mock).mockReturnValue(false);

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      expect(header).not.toHaveBeenCalledWith('Top Opportunities');
      consoleSpy.mockRestore();
    });
  });

  // ── JSON Output ────────────────────────────────────────────────────────

  describe('JSON output', () => {
    it('outputs valid JSON when --json is passed', async () => {
      (existsSync as Mock).mockReturnValue(true);
      (readdir as Mock).mockResolvedValue(['snap.json']);
      (readFile as Mock).mockResolvedValue(JSON.stringify(makeSnapshot()));

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction({ json: true });

      // Should have logged exactly one JSON blob
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
      expect(output).toHaveProperty('overall_health', 78);
      expect(output).toHaveProperty('maturity_scores');
      expect(output).toHaveProperty('opportunity_count');
      expect(output).toHaveProperty('snapshot_id', 'snap-1');
      consoleSpy.mockRestore();
    });

    it('keeps health null when no recorded analysis exists in JSON mode', async () => {
      (existsSync as Mock).mockReturnValue(false);
      (readdir as Mock).mockResolvedValue([]);

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction({ json: true });

      const output = JSON.parse(consoleSpy.mock.calls[0]![0] as string);
      expect(output.snapshot_id).toBeNull();
      expect(output.snapshot_timestamp).toBeNull();
      expect(output.overall_health).toBeNull();
      consoleSpy.mockRestore();
    });

    it('does not call banner() in JSON mode', async () => {
      (existsSync as Mock).mockReturnValue(false);

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction({ json: true });

      expect(banner).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ── Snapshot Loading ───────────────────────────────────────────────────

  describe('snapshot loading', () => {
    it('picks the latest snapshot by timestamp', async () => {
      const older = makeSnapshot({ timestamp: '2024-01-01T00:00:00Z', overall_health: 50 });
      const newer = makeSnapshot({ timestamp: '2024-06-15T00:00:00Z', overall_health: 92 });

      (existsSync as Mock).mockImplementation((path: string) => {
        return path.includes('snapshots');
      });

      (readdir as Mock).mockResolvedValue(['old.json', 'new.json']);

      let readCallCount = 0;
      (readFile as Mock).mockImplementation(() => {
        readCallCount++;
        if (readCallCount === 1) return Promise.resolve(JSON.stringify(older));
        return Promise.resolve(JSON.stringify(newer));
      });

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      // Should use the newer snapshot's health score
      expect(progressBar).toHaveBeenCalledWith(92, 100, 40);
      consoleSpy.mockRestore();
    });

    it('skips malformed snapshot files', async () => {
      (existsSync as Mock).mockImplementation((path: string) => {
        return path.includes('snapshots');
      });

      (readdir as Mock).mockResolvedValue(['bad.json', 'good.json']);

      let readCallCount = 0;
      (readFile as Mock).mockImplementation(() => {
        readCallCount++;
        if (readCallCount === 1) return Promise.resolve('not valid json{{{');
        return Promise.resolve(JSON.stringify(makeSnapshot({ overall_health: 65 })));
      });

      const { runAction } = createFakeProgram();
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await runAction();

      expect(progressBar).toHaveBeenCalledWith(65, 100, 40);
      consoleSpy.mockRestore();
    });
  });
});
