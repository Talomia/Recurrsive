/**
 * Tests for the `recurrsive comparisons` command.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockApiRequest } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
}));

vi.mock('../../config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config.js')>();
  return {
    ...actual,
    apiRequest: mockApiRequest,
    apiRequestData: (...a: unknown[]) =>
      (mockApiRequest as (...x: unknown[]) => Promise<{ data?: unknown }>)(...a).then((e) => e?.data),
    apiRequestList: (...a: unknown[]) =>
      (mockApiRequest as (...x: unknown[]) => Promise<{ data?: unknown[]; total?: number }>)(...a).then((e) => ({
        items: e?.data ?? [],
        total: e?.total ?? (e?.data?.length ?? 0),
      })),
  };
});

vi.mock('../../output/terminal.js', () => ({
  header: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  bold: (s: string) => s,
  cyan: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
  red: (s: string) => s,
  dim: (s: string) => s,
  table: vi.fn(),
}));

import { registerComparisonsCommand } from '../../commands/comparisons.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCLI(): Command {
  const program = new Command();
  program.exitOverride();
  registerComparisonsCommand(program);
  return program;
}

function run(id: string, healthScore: number, findingCount: number, opportunityCount: number) {
  return {
    id,
    startedAt: '2026-06-20T08:00:00Z',
    completedAt: '2026-06-20T08:05:00Z',
    durationMs: 300000,
    findingCount,
    opportunityCount,
    includeReasoning: true,
    healthScore,
    status: 'success' as const,
    error: null,
  };
}

const MOCK_RUNS = [run('run_001', 71, 55, 18), run('run_005', 87, 34, 29)];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('comparisons command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  describe('list', () => {
    it('fetches analysis history', async () => {
      mockApiRequest.mockResolvedValueOnce({ data: MOCK_RUNS, total: MOCK_RUNS.length });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'comparisons', 'list']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/analysis/history'),
      );
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await expect(
        program.parseAsync(['node', 'test', 'comparisons', 'list']),
      ).rejects.toThrow();
    });
  });

  describe('diff', () => {
    it('compares two runs from history', async () => {
      mockApiRequest.mockResolvedValueOnce({ data: MOCK_RUNS, total: MOCK_RUNS.length });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'comparisons', 'diff', 'run_001', 'run_005']);

      // The diff is derived from real history — no separate compare endpoint.
      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/analysis/history'),
      );
    });

    it('outputs JSON with --json flag', async () => {
      mockApiRequest.mockResolvedValueOnce({ data: MOCK_RUNS, total: MOCK_RUNS.length });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'comparisons', 'diff', 'run_001', 'run_005', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('healthDelta'));
      spy.mockRestore();
    });
  });
});
