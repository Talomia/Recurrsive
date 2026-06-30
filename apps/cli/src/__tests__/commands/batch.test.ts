/**
 * Tests for the `recurrsive batch` command.
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

import { registerBatchCommand } from '../../commands/batch.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCLI(): Command {
  const program = new Command();
  program.exitOverride();
  registerBatchCommand(program);
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

describe('batch command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  describe('run', () => {
    it('sends projects to the batch API', async () => {
      mockApiResponse({
        batch_id: 'batch_001',
        status: 'pending',
        projects: [{ path: '/p1', status: 'pending' }],
        created_at: new Date().toISOString(),
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'batch', 'run', '/p1']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/batch/analyze'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('falls back gracefully when server is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'batch', 'run', '/p1', '/p2']);

      expect(process.exitCode).toBeUndefined();
    });

    it('rejects more than 10 projects', async () => {
      const paths = Array.from({ length: 11 }, (_, i) => `/p${i}`);

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'batch', 'run', ...paths]);

      expect(process.exitCode).toBe(1);
    });

    it('outputs JSON with --json flag', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'batch', 'run', '/p1', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('batch_'));
      spy.mockRestore();
    });
  });

  describe('status', () => {
    it('fetches batch status from server', async () => {
      mockApiResponse({
        batch_id: 'batch_001',
        status: 'complete',
        projects: [{ path: '/p1', status: 'complete', findings_count: 5, opportunities_count: 2 }],
        created_at: new Date().toISOString(),
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'batch', 'status', 'batch_001']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/batch/status/batch_001'),
        expect.any(Object),
      );
    });

    it('falls back gracefully when server unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'batch', 'status', 'batch_xyz']);

      expect(process.exitCode).toBeUndefined();
    });
  });

  describe('history', () => {
    it('fetches batch history from server', async () => {
      mockApiResponse({
        batches: [
          {
            batch_id: 'batch_001',
            status: 'complete',
            projects: [],
            created_at: new Date().toISOString(),
          },
        ],
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'batch', 'history']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/batch/history'),
        expect.any(Object),
      );
    });

    it('falls back to mock data when server unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'batch', 'history']);

      expect(process.exitCode).toBeUndefined();
    });

    it('outputs JSON with --json flag', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'batch', 'history', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('batch_'));
      spy.mockRestore();
    });
  });
});
