/**
 * Tests for the `recurrsive analytics` command.
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
      mockApiRequest.mockResolvedValueOnce({
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

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/analytics/summary'),
      );
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'analytics', 'summary']);

      expect(process.exitCode).toBe(1);
    });

    it('outputs JSON with --json flag', async () => {
      mockApiRequest.mockResolvedValueOnce({
        analysis_runs: 47,
        total_findings: 312,
        findings_resolved: 189,
        resolution_rate: 60.6,
        avg_health_score: 74.2,
        trends: [],
      });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'analytics', 'summary', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('analysis_runs'));
      spy.mockRestore();
    });
  });

  describe('categories', () => {
    it('displays category data', async () => {
      mockApiRequest.mockResolvedValueOnce({
        categories: [
          { name: 'Performance', count: 68, percentage: 21.8 },
          { name: 'Security', count: 42, percentage: 13.5 },
        ],
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'analytics', 'categories']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/analytics/top-categories'),
      );
    });
  });
});
