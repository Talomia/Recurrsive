/**
 * Tests for the `recurrsive analytics` command.
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

import { registerAnalyticsCommand } from '../../commands/analytics.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCLI(): Command {
  const program = new Command();
  program.exitOverride();
  registerAnalyticsCommand(program);
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

describe('analytics command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  describe('summary', () => {
    it('fetches and displays summary data', async () => {
      mockApiResponse({
        analysis_runs: 47,
        total_findings: 312,
        findings_resolved: 189,
        resolution_rate: 60.6,
        avg_health_score: 74.2,
        trends: [
          { date: '2026-04-06', findings: 28, resolved: 12, health: 68 },
        ],
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'analytics', 'summary']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/analytics/summary'),
        expect.any(Object),
      );
    });

    it('falls back on server error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'analytics', 'summary']);

      expect(process.exitCode).toBeUndefined();
    });

    it('outputs JSON with --json flag', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'analytics', 'summary', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('analysis_runs'));
      spy.mockRestore();
    });
  });

  describe('categories', () => {
    it('displays category data', async () => {
      mockApiResponse({
        categories: [
          { name: 'Performance', count: 68, percentage: 21.8 },
          { name: 'Security', count: 42, percentage: 13.5 },
        ],
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'analytics', 'categories']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/analytics/top-categories'),
        expect.any(Object),
      );
    });
  });
});
