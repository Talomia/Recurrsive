/**
 * Unit tests for the `recurrsive opportunities` command.
 *
 * Tests cover:
 * - Lists opportunities with default settings
 * - Filters by --filter (category)
 * - Filters by --status
 * - Limits with --top N
 * - Shows detail for a single opportunity
 * - Handles no opportunities gracefully
 * - Accept/reject workflow
 * - Export to various formats
 * - Detail with partial ID match
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock external dependencies
// ---------------------------------------------------------------------------

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config/loader.js', () => ({
  loadConfig: vi.fn(),
}));

// Stateful mock for OpportunityManager
const mockOpportunities: any[] = [];

const mockManagerInstance = {
  load: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockImplementation((filters?: any) => {
    let result = [...mockOpportunities];
    if (filters?.category) {
      result = result.filter((o: any) => o.category === filters.category);
    }
    if (filters?.status) {
      result = result.filter((o: any) => o.status === filters.status);
    }
    return result;
  }),
  get: vi.fn().mockImplementation((id: string) => {
    return mockOpportunities.find((o: any) => o.id === id) ?? null;
  }),
  count: 0,
  updateStatus: vi.fn().mockImplementation((id: string) => {
    const opp = mockOpportunities.find((o: any) => o.id === id);
    if (!opp) throw new Error(`Opportunity not found: ${id}`);
    return opp;
  }),
  save: vi.fn().mockResolvedValue(undefined),
  export: vi.fn().mockReturnValue('exported content'),
};

vi.mock('@recurrsive/opportunities', () => ({
  OpportunityManager: vi.fn().mockImplementation(() => mockManagerInstance),
}));

vi.mock('../../output/terminal.js', () => ({
  header: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
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
import { writeFile } from 'node:fs/promises';
import { loadConfig } from '../../config/loader.js';
import { registerOpportunitiesCommand } from '../../commands/opportunities.js';
import {
  header,
  success,
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

/** Create a minimal opportunity-like object. */
function makeOpportunity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'opp-001',
    title: 'Test Opportunity',
    type: 'opportunity',
    category: 'architecture',
    severity: 'medium',
    confidence: 0.8,
    status: 'proposed',
    problem: 'A problem',
    recommendation: 'Fix it',
    effort: { t_shirt: 's' },
    risk: { level: 'low', description: 'Low risk', mitigations: [] },
    expected_impact: { summary: 'Good impact', metrics: [], affected_services: [] },
    evidence: [],
    locations: [],
    validation: { steps: [], success_criteria: [] },
    ...overrides,
  };
}

/** Helper to populate mock state with opportunities. */
function setOpportunities(...opps: any[]) {
  mockOpportunities.length = 0;
  mockOpportunities.push(...opps);
  mockManagerInstance.count = mockOpportunities.length;
}

/**
 * Create a fake Commander program that captures the action handler
 * for the `opportunities` command.
 */
function createFakeProgram() {
  let actionHandler:
    | ((opts: Record<string, unknown>) => Promise<void>)
    | null = null;

  const commandChain = {
    description: vi.fn().mockReturnThis(),
    alias: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    action: vi.fn((fn: typeof actionHandler) => {
      actionHandler = fn;
      return commandChain;
    }),
  };

  const program = {
    command: vi.fn().mockReturnValue(commandChain),
  };

  registerOpportunitiesCommand(program as any);

  return {
    program,
    commandChain,
    runAction: (opts: Record<string, unknown> = {}) => {
      if (!actionHandler) throw new Error('action not registered');
      return actionHandler(opts);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerOpportunitiesCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (loadConfig as Mock).mockResolvedValue(defaultConfigResult);
    (existsSync as Mock).mockReturnValue(true);
    // Reset mock state
    mockOpportunities.length = 0;
    mockManagerInstance.count = 0;
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  // ── Command Registration ───────────────────────────────────────────────

  describe('command registration', () => {
    it('registers the "opportunities" command', () => {
      const { program } = createFakeProgram();
      expect(program.command).toHaveBeenCalledWith('opportunities');
    });

    it('has alias "opps"', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.alias).toHaveBeenCalledWith('opps');
    });

    it('has --filter option', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.option).toHaveBeenCalledWith(
        '--filter <category>',
        expect.any(String),
      );
    });

    it('has --top option', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.option).toHaveBeenCalledWith(
        '--top <n>',
        expect.any(String),
        expect.any(Function),
      );
    });

    it('has --detail option', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.option).toHaveBeenCalledWith(
        '--detail <id>',
        expect.any(String),
      );
    });
  });

  // ── List Mode ─────────────────────────────────────────────────────────

  describe('list mode', () => {
    it('lists opportunities with default settings', async () => {
      setOpportunities(
        makeOpportunity(),
        makeOpportunity({ id: 'opp-002', title: 'Second Opp' }),
      );

      const { runAction } = createFakeProgram();
      await runAction();

      expect(header).toHaveBeenCalledWith('Opportunities');
      expect(table).toHaveBeenCalledWith(
        expect.arrayContaining(['Title']),
        expect.any(Array),
      );
    });

    it('shows summary counts', async () => {
      setOpportunities(
        makeOpportunity({ type: 'opportunity' }),
        makeOpportunity({ id: 'opp-002', type: 'risk' }),
        makeOpportunity({ id: 'opp-003', type: 'debt' }),
      );

      const { runAction } = createFakeProgram();
      await runAction();

      // Summary line includes total and type counts
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Total:'),
      );
    });

    it('passes category filter to list()', async () => {
      setOpportunities(
        makeOpportunity({ category: 'security' }),
        makeOpportunity({ id: 'opp-002', category: 'architecture' }),
      );

      const { runAction } = createFakeProgram();
      await runAction({ filter: 'security' });

      expect(mockManagerInstance.list).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'security' }),
      );
    });

    it('passes status filter to list()', async () => {
      setOpportunities(
        makeOpportunity({ status: 'accepted' }),
        makeOpportunity({ id: 'opp-002', status: 'proposed' }),
      );

      const { runAction } = createFakeProgram();
      await runAction({ status: 'accepted' });

      expect(mockManagerInstance.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'accepted' }),
      );
    });

    it('limits results with --top N', async () => {
      setOpportunities(
        makeOpportunity({ id: 'opp-001' }),
        makeOpportunity({ id: 'opp-002' }),
        makeOpportunity({ id: 'opp-003' }),
        makeOpportunity({ id: 'opp-004' }),
        makeOpportunity({ id: 'opp-005' }),
      );

      const { runAction } = createFakeProgram();
      await runAction({ top: 2 });

      // table() should have been called with exactly 2 rows
      const tableCall = (table as Mock).mock.calls[0];
      expect(tableCall).toBeDefined();
      const rows = tableCall![1] as string[][];
      expect(rows).toHaveLength(2);
    });
  });

  // ── No Opportunities ──────────────────────────────────────────────────

  describe('handles no opportunities', () => {
    it('shows info when no opportunities exist', async () => {
      // existsSync returns false → loadOpportunities returns null
      (existsSync as Mock).mockReturnValue(false);

      const { runAction } = createFakeProgram();
      await runAction();

      expect(info).toHaveBeenCalledWith('No opportunities found.');
    });

    it('shows info when opportunities file exists but is empty', async () => {
      // Manager exists but has count 0
      mockManagerInstance.count = 0;

      const { runAction } = createFakeProgram();
      await runAction();

      expect(info).toHaveBeenCalledWith('No opportunities found.');
    });

    it('suggests running analyze first', async () => {
      (existsSync as Mock).mockReturnValue(false);

      const { runAction } = createFakeProgram();
      await runAction();

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('recurrsive analyze'),
      );
    });
  });

  // ── Detail View ───────────────────────────────────────────────────────

  describe('detail view', () => {
    it('shows full detail for a single opportunity by exact ID', async () => {
      const opp = makeOpportunity();
      setOpportunities(opp);

      const { runAction } = createFakeProgram();
      await runAction({ detail: 'opp-001' });

      expect(mockManagerInstance.get).toHaveBeenCalledWith('opp-001');
      // printDetail calls console.log with the opportunity title
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test Opportunity'),
      );
    });

    it('tries partial match when exact ID not found', async () => {
      const opp = makeOpportunity({ id: 'opp-full-id-12345', title: 'Special Opp' });
      setOpportunities(opp);
      // get() returns null for partial, list() returns all
      mockManagerInstance.get.mockReturnValueOnce(null);

      const { runAction } = createFakeProgram();
      await runAction({ detail: 'opp-full' });

      // Should still find by partial match and print detail
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Special Opp'),
      );
    });

    it('shows error when opportunity is not found at all', async () => {
      setOpportunities(makeOpportunity());
      mockManagerInstance.get.mockReturnValueOnce(null);

      const { runAction } = createFakeProgram();
      await runAction({ detail: 'nonexistent-id' });

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Opportunity not found'),
      );
    });
  });

  // ── Accept / Reject ───────────────────────────────────────────────────

  describe('accept/reject', () => {
    it('accepts an opportunity', async () => {
      const opp = makeOpportunity();
      setOpportunities(opp);

      const { runAction } = createFakeProgram();
      await runAction({ accept: 'opp-001' });

      expect(mockManagerInstance.updateStatus).toHaveBeenCalledWith(
        'opp-001',
        'accepted',
        expect.any(String),
      );
      expect(mockManagerInstance.save).toHaveBeenCalled();
      expect(success).toHaveBeenCalledWith(
        expect.stringContaining('Accepted'),
      );
    });

    it('rejects an opportunity with a reason', async () => {
      const opp = makeOpportunity();
      setOpportunities(opp);

      const { runAction } = createFakeProgram();
      await runAction({ reject: 'opp-001', reason: 'Not needed' });

      expect(mockManagerInstance.updateStatus).toHaveBeenCalledWith(
        'opp-001',
        'rejected',
        'Not needed',
      );
      expect(success).toHaveBeenCalledWith(
        expect.stringContaining('Rejected'),
      );
    });

    it('shows error when accepting a non-existent opportunity', async () => {
      setOpportunities(makeOpportunity());
      mockManagerInstance.updateStatus.mockImplementationOnce(() => {
        throw new Error('Opportunity not found: bad-id');
      });

      const { runAction } = createFakeProgram();
      await runAction({ accept: 'bad-id' });

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Opportunity not found'),
      );
    });
  });

  // ── Export ─────────────────────────────────────────────────────────────

  describe('export', () => {
    it('exports opportunities in the requested format', async () => {
      setOpportunities(makeOpportunity());

      const { runAction } = createFakeProgram();
      await runAction({ export: 'json' });

      expect(mockManagerInstance.export).toHaveBeenCalledWith('json');
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('opportunities.json'),
        'exported content',
        'utf-8',
      );
      expect(success).toHaveBeenCalledWith(
        expect.stringContaining('Exported'),
      );
    });

    it('rejects unsupported export formats', async () => {
      setOpportunities(makeOpportunity());

      const { runAction } = createFakeProgram();
      await runAction({ export: 'xml' });

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Unsupported export format'),
      );
    });
  });

  // ── Filtered List Shows Message ────────────────────────────────────────

  describe('filtered results', () => {
    it('shows info when no opportunities match filters', async () => {
      setOpportunities(
        makeOpportunity({ category: 'architecture' }),
      );

      const { runAction } = createFakeProgram();
      await runAction({ filter: 'security' });

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('No opportunities match'),
      );
    });
  });
});
