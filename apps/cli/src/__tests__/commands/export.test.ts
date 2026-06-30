/**
 * Tests for the `recurrsive export` command.
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

describe('export command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  describe('create', () => {
    it('creates an export via API', async () => {
      mockApiResponse({
        export_id: 'exp_test123',
        format: 'json',
        scope: 'findings',
        status: 'completed',
        download_url: '/api/v1/export/exp_test123/download',
        record_count: 47,
        generated_at: '2026-06-30T12:00:00.000Z',
      }, 201);

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'export', 'create', 'findings', '--format', 'json']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/export'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('falls back to mock data on server error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'export', 'create', 'all']);

      // Should not set exitCode — mock fallback succeeds
      expect(process.exitCode).toBeUndefined();
    });
  });

  describe('history', () => {
    it('fetches and displays export history', async () => {
      mockApiResponse({
        data: [
          {
            export_id: 'exp_abc',
            format: 'json',
            scope: 'findings',
            status: 'completed',
            record_count: 10,
            generated_at: '2026-06-30T12:00:00.000Z',
          },
        ],
        total: 1,
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'export', 'history']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/export/history'),
        expect.any(Object),
      );
    });
  });

  describe('--json flag', () => {
    it('outputs JSON for create command', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'export', 'create', 'findings', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('export_id'));
      spy.mockRestore();
    });
  });
});
