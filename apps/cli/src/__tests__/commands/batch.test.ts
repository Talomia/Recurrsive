/**
 * Tests for the `recurrsive batch` command.
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
      mockApiRequest.mockResolvedValueOnce({
        data: {
          batch_id: 'batch_001',
          status: 'pending',
          projects: [{ path: '/p1', status: 'pending' }],
          created_at: new Date().toISOString(),
        },
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'batch', 'run', '/p1']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/batch/analyze'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await expect(
        program.parseAsync(['node', 'test', 'batch', 'run', '/p1', '/p2']),
      ).rejects.toThrow();
    });

    it('rejects more than 10 projects', async () => {
      const paths = Array.from({ length: 11 }, (_, i) => `/p${i}`);

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'batch', 'run', ...paths]);

      expect(process.exitCode).toBe(1);
    });

    it('outputs JSON with --json flag', async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: {
          batch_id: 'batch_002',
          status: 'pending',
          projects: [{ path: '/p1', status: 'pending' }],
          created_at: new Date().toISOString(),
        },
      });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'batch', 'run', '/p1', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('batch_'));
      spy.mockRestore();
    });
  });

  describe('status', () => {
    it('fetches batch status from server', async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: {
          batch_id: 'batch_001',
          status: 'completed',
          projects: [{ path: '/p1', status: 'completed' }],
          created_at: new Date().toISOString(),
        },
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'batch', 'status', 'batch_001']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/batch/status/batch_001'),
      );
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await expect(
        program.parseAsync(['node', 'test', 'batch', 'status', 'batch_xyz']),
      ).rejects.toThrow();
    });
  });

  describe('history', () => {
    it('fetches batch history from server', async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: [
          {
            batch_id: 'batch_001',
            status: 'completed',
            projects: [],
            created_at: new Date().toISOString(),
          },
        ],
        total: 1,
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'batch', 'history']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/batch/history'),
      );
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await expect(
        program.parseAsync(['node', 'test', 'batch', 'history']),
      ).rejects.toThrow();
    });

    it('outputs JSON with --json flag', async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: [
          {
            batch_id: 'batch_003',
            status: 'completed',
            projects: [],
            created_at: new Date().toISOString(),
          },
        ],
        total: 1,
      });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'batch', 'history', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('batch_'));
      spy.mockRestore();
    });
  });
});
