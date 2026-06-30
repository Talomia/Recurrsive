/**
 * Tests for the `recurrsive comparisons` command.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../../output/terminal.js', () => ({
  header: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  bold: (s: string) => s,
  cyan: (s: string) => s,
  green: (s: string) => s,
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

function mockApiResponse(data: unknown, status = 200): void {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

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
      mockApiResponse({
        data: [
          { id: 'run_001', label: 'Run #1', date: '2026-06-20T08:00:00Z', health_score: 71, findings: 55, resolved: 18 },
          { id: 'run_002', label: 'Run #2', date: '2026-06-23T10:30:00Z', health_score: 76, findings: 48, resolved: 22 },
        ],
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'comparisons', 'list']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/analysis/history'),
        expect.any(Object),
      );
    });

    it('falls back on server error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'comparisons', 'list']);

      // Should not set exitCode — graceful fallback
      expect(process.exitCode).toBeUndefined();
    });
  });

  describe('diff', () => {
    it('compares two runs', async () => {
      mockApiResponse({
        baseline: { id: 'run_001', label: 'Run #1', date: '2026-06-20T08:00:00Z', health_score: 71, findings: 55, resolved: 18 },
        target: { id: 'run_005', label: 'Run #5', date: '2026-06-30T10:00:00Z', health_score: 87, findings: 34, resolved: 29 },
        health_delta: 16,
        findings_delta: -21,
        resolution_rate_baseline: 32.7,
        resolution_rate_target: 85.3,
        resolution_rate_delta: 52.6,
        new_findings: 16,
        findings_resolved: 32,
        categories: [
          { name: 'Security', baseline: 12, target: 5, delta: -7 },
        ],
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'comparisons', 'diff', 'run_001', 'run_005']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/analysis/compare'),
        expect.any(Object),
      );
    });

    it('outputs JSON with --json flag', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'comparisons', 'diff', 'run_001', 'run_005', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('health_delta'));
      spy.mockRestore();
    });
  });
});
