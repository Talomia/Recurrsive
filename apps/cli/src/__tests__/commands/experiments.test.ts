/**
 * Tests for the `recurrsive experiments` command.
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


import { registerExperimentsCommand } from '../../commands/experiments.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCLI(): Command {
  const program = new Command();
  program.exitOverride();
  registerExperimentsCommand(program);
  return program;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('experiments command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  describe('list', () => {
    it('fetches experiments from the API', async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: [
          { id: 'exp_001', name: 'test-exp', status: 'draft', created_at: new Date().toISOString() },
        ],
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'list']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/experiments'),
      );
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await expect(
        program.parseAsync(['node', 'test', 'experiments', 'list']),
      ).rejects.toThrow();
    });

    it('supports --status filter', async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: [
          { id: 'exp_002', name: 'running-exp', status: 'running', created_at: new Date().toISOString() },
        ],
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'list', '--status', 'running']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('status=running'),
      );
    });

    it('outputs JSON with --json flag', async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: [
          { id: 'exp_001', name: 'test-exp', status: 'draft', created_at: new Date().toISOString() },
        ],
      });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'list', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('exp_001'));
      spy.mockRestore();
    });
  });

  describe('create', () => {
    it('sends POST to create an experiment', async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: {
          id: 'exp_new',
          name: 'my-experiment',
          status: 'draft',
          created_at: new Date().toISOString(),
        },
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'create', 'my-experiment']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/experiments'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('includes hypothesis when provided', async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: {
          id: 'exp_new',
          name: 'my-experiment',
          hypothesis: 'It will be faster',
          status: 'draft',
          created_at: new Date().toISOString(),
        },
      });

      const program = createCLI();
      await program.parseAsync([
        'node', 'test', 'experiments', 'create', 'my-experiment',
        '--hypothesis', 'It will be faster',
      ]);

      const body = JSON.parse(mockApiRequest.mock.calls[0][1].body);
      expect(body.hypothesis).toBe('It will be faster');
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await expect(
        program.parseAsync(['node', 'test', 'experiments', 'create', 'my-experiment']),
      ).rejects.toThrow();
    });
  });

  describe('status', () => {
    it('fetches experiment by ID', async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: {
          id: 'exp_001',
          name: 'test-exp',
          status: 'complete',
          created_at: new Date().toISOString(),
        },
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'status', 'exp_001']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/experiments/exp_001'),
      );
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await expect(
        program.parseAsync(['node', 'test', 'experiments', 'status', 'exp_001']),
      ).rejects.toThrow();
    });

    it('outputs JSON with --json flag', async () => {
      mockApiRequest.mockResolvedValueOnce({
        data: {
          id: 'exp_001',
          name: 'test-exp',
          status: 'complete',
          created_at: new Date().toISOString(),
        },
      });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'status', 'exp_001', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('exp_001'));
      spy.mockRestore();
    });
  });
});
