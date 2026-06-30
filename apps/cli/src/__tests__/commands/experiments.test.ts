/**
 * Tests for the `recurrsive experiments` command.
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

describe('experiments command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
  });

  describe('list', () => {
    it('fetches experiments from the API', async () => {
      mockApiResponse({
        data: [
          { id: 'exp_001', name: 'test-exp', status: 'draft', created_at: new Date().toISOString() },
        ],
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'list']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/experiments'),
        expect.any(Object),
      );
    });

    it('falls back on server error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'list']);

      // Should not set error exit code — fallback is graceful
      expect(process.exitCode).toBeUndefined();
    });

    it('supports --status filter', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'list', '--status', 'running']);

      // Graceful fallback with filter applied
      expect(process.exitCode).toBeUndefined();
    });

    it('outputs JSON with --json flag', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'list', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('exp_'));
      spy.mockRestore();
    });
  });

  describe('create', () => {
    it('sends POST to create an experiment', async () => {
      mockApiResponse({
        id: 'exp_new',
        name: 'my-experiment',
        status: 'draft',
        created_at: new Date().toISOString(),
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'create', 'my-experiment']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/experiments'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('includes hypothesis when provided', async () => {
      mockApiResponse({
        id: 'exp_new',
        name: 'my-experiment',
        hypothesis: 'It will be faster',
        status: 'draft',
        created_at: new Date().toISOString(),
      });

      const program = createCLI();
      await program.parseAsync([
        'node', 'test', 'experiments', 'create', 'my-experiment',
        '--hypothesis', 'It will be faster',
      ]);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.hypothesis).toBe('It will be faster');
    });

    it('falls back gracefully when server unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'create', 'my-experiment']);

      expect(process.exitCode).toBeUndefined();
    });
  });

  describe('status', () => {
    it('fetches experiment by ID', async () => {
      mockApiResponse({
        id: 'exp_001',
        name: 'test-exp',
        status: 'complete',
        created_at: new Date().toISOString(),
      });

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'status', 'exp_001']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/experiments/exp_001'),
        expect.any(Object),
      );
    });

    it('falls back gracefully when server unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'status', 'exp_001']);

      expect(process.exitCode).toBeUndefined();
    });

    it('outputs JSON with --json flag', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'status', 'exp_001', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('exp_001'));
      spy.mockRestore();
    });
  });
});
