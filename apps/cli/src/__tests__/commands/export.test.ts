/**
 * Tests for the `recurrsive export` command.
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

import { registerExportCommand } from '../../commands/export.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCLI(): Command {
  const program = new Command();
  program.exitOverride();
  registerExportCommand(program);
  return program;
}

const MOCK_EXPORT = {
  export_id: 'exp_test123',
  format: 'json',
  scope: 'findings',
  status: 'completed',
  download_url: '/api/v1/export/exp_test123/download',
  record_count: 47,
  generated_at: '2026-06-30T12:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('export command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  describe('create', () => {
    it('creates an export via API', async () => {
      mockApiRequest.mockResolvedValueOnce({ data: MOCK_EXPORT });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'export', 'create', 'findings', '--format', 'json']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/export'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await expect(
        program.parseAsync(['node', 'test', 'export', 'create', 'all']),
      ).rejects.toThrow();
    });
  });

  describe('history', () => {
    it('fetches and displays export history', async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: [MOCK_EXPORT],
        total: 1,
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'export', 'history']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/export/history'),
      );
    });
  });

  describe('--json flag', () => {
    it('outputs JSON for create command', async () => {
      mockApiRequest.mockResolvedValueOnce({ data: MOCK_EXPORT });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'export', 'create', 'findings', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('export_id'));
      spy.mockRestore();
    });
  });
});
