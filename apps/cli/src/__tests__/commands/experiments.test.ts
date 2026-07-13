/**
 * Tests for the `recurrsive experiments` command.
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
    mockApiRequest.mockReset();
    process.exitCode = undefined;
  });

  describe('list', () => {
    it('fetches experiments from the API', async () => {
      mockApiRequest.mockResolvedValueOnce([
        { id: 'exp_001', name: 'test-exp', status: 'pending', createdAt: new Date().toISOString() },
      ]);

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'list']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/experiments'),
      );
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'list']);

      expect(process.exitCode).toBe(1);
    });

    it('supports --status filter', async () => {
      mockApiRequest.mockResolvedValueOnce([
        { id: 'exp_002', name: 'running-exp', status: 'running', createdAt: new Date().toISOString() },
      ]);

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'list', '--status', 'running']);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('status=running'),
      );
    });

    it('outputs JSON with --json flag', async () => {
      mockApiRequest.mockResolvedValueOnce([
        { id: 'exp_001', name: 'test-exp', status: 'pending', createdAt: new Date().toISOString() },
      ]);
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
        id: 'exp_new',
        name: 'my-experiment',
        hypothesis: 'The candidate configuration is better',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      const program = createCLI();
      await program.parseAsync([
        'node', 'test', 'experiments', 'create', 'my-experiment',
        '--hypothesis', 'The candidate configuration is better',
        '--control-analyzers', 'architecture.structural',
        '--candidate-analyzers', 'architecture.structural,security.vulnerabilities',
      ]);

      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/experiments'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('includes hypothesis when provided', async () => {
      mockApiRequest.mockResolvedValueOnce({
        id: 'exp_new',
        name: 'my-experiment',
        hypothesis: 'It will be faster',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      const program = createCLI();
      await program.parseAsync([
        'node', 'test', 'experiments', 'create', 'my-experiment',
        '--hypothesis', 'It will be faster',
        '--control-analyzers', 'architecture.structural',
        '--candidate-analyzers', 'performance.general',
      ]);

      const body = JSON.parse(mockApiRequest.mock.calls[0][1].body);
      expect(body.hypothesis).toBe('It will be faster');
    });

    it('exits with error on server failure', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const program = createCLI();
      await program.parseAsync([
        'node', 'test', 'experiments', 'create', 'my-experiment',
        '--hypothesis', 'It will be faster',
        '--control-analyzers', 'architecture.structural',
        '--candidate-analyzers', 'performance.general',
      ]);

      expect(process.exitCode).toBe(1);
    });
  });

  describe('status', () => {
    it('fetches experiment by ID', async () => {
      mockApiRequest.mockResolvedValueOnce({
        id: 'exp_001',
        name: 'test-exp',
        hypothesis: 'Candidate is better',
        status: 'completed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        results: [],
        conclusion: null,
        error: null,
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
      await program.parseAsync(['node', 'test', 'experiments', 'status', 'exp_001']);

      expect(process.exitCode).toBe(1);
    });

    it('outputs JSON with --json flag', async () => {
      mockApiRequest.mockResolvedValueOnce({
        id: 'exp_001',
        name: 'test-exp',
        hypothesis: 'Candidate is better',
        status: 'completed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        results: [],
        conclusion: null,
        error: null,
      });
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const program = createCLI();
      await program.parseAsync(['node', 'test', 'experiments', 'status', 'exp_001', '--json']);

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('exp_001'));
      spy.mockRestore();
    });
  });
});
