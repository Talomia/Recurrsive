/**
 * Tests for the `recurrsive comparisons` command.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import type * as ConfigModule from '../../config.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockApiRequest } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
}));

vi.mock('../../config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ConfigModule>();
  return { ...actual, apiRequest: mockApiRequest };
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

const MOCK_RUNS = [
  { id: 'run_001', startedAt: '2026-06-20T08:00:00Z', durationMs: 1000, findingCount: 55, opportunityCount: 18, healthScore: 71, status: 'success' },
  { id: 'run_002', startedAt: '2026-06-23T10:30:00Z', durationMs: 900, findingCount: 48, opportunityCount: 22, healthScore: 76, status: 'success' },
];

const MOCK_DIFF = {
  runA: { id: 'run_001', label: 'Run #1', date: '2026-06-20T08:00:00Z', health_score: 71, findings: 55, opportunities: 18, duration_ms: 1000 },
  runB: { id: 'run_005', label: 'Run #5', date: '2026-06-30T10:00:00Z', health_score: 87, findings: 34, opportunities: 29, duration_ms: 800 },
  health_delta: 16,
  findings_delta: -21,
  opportunities_delta: 11,
  duration_delta_ms: -200,
};

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
      mockApiRequest.mockResolvedValueOnce({ data: MOCK_RUNS });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'comparisons', 'list']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/analysis/history'),
      );
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'comparisons', 'list']);

      expect(process.exitCode).toBe(1);
    });
  });

  describe('diff', () => {
    it('compares two runs', async () => {
      mockApiRequest.mockResolvedValueOnce({ data: MOCK_DIFF });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'comparisons', 'diff', 'run_001', 'run_005']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/analysis/compare'),
      );
    });

    it('outputs JSON with --json flag', async () => {
      mockApiRequest.mockResolvedValueOnce({ data: MOCK_DIFF });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'comparisons', 'diff', 'run_001', 'run_005', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('health_delta'));
      spy.mockRestore();
    });
  });
});
