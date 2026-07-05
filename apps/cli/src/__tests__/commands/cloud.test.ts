/**
 * Tests for the `recurrsive cloud` command.
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
  magenta: (s: string) => s,
  progressBar: vi.fn((_v: number, _m: number, _w: number) => '[████████]'),
  table: vi.fn(),
}));

import { registerCloudCommand } from '../../commands/cloud.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCLI(): Command {
  const program = new Command();
  program.exitOverride();
  registerCloudCommand(program);
  return program;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cloud command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    mockApiRequest.mockResolvedValue([
      { metric: 'Code Quality', yourScore: 82, industryAvg: 68, percentile: 78 },
    ]);
  });

  it('registers the "cloud" command', () => {
    const program = createCLI();
    const cmd = program.commands.find((c) => c.name() === 'cloud');
    expect(cmd).toBeDefined();
  });

  it('has a "benchmarks" subcommand', () => {
    const program = createCLI();
    const cloud = program.commands.find((c) => c.name() === 'cloud')!;
    const sub = cloud.commands.find((c) => c.name() === 'benchmarks');
    expect(sub).toBeDefined();
  });

  it('has a "patterns" subcommand', () => {
    const program = createCLI();
    const cloud = program.commands.find((c) => c.name() === 'cloud')!;
    const sub = cloud.commands.find((c) => c.name() === 'patterns');
    expect(sub).toBeDefined();
  });

  it('has a "partners" subcommand', () => {
    const program = createCLI();
    const cloud = program.commands.find((c) => c.name() === 'cloud')!;
    const sub = cloud.commands.find((c) => c.name() === 'partners');
    expect(sub).toBeDefined();
  });

  it('has a "status" subcommand', () => {
    const program = createCLI();
    const cloud = program.commands.find((c) => c.name() === 'cloud')!;
    const sub = cloud.commands.find((c) => c.name() === 'status');
    expect(sub).toBeDefined();
  });

  it('benchmarks subcommand supports --json option', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const program = createCLI();
    await program.parseAsync(['node', 'test', 'cloud', 'benchmarks', '--json']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('status subcommand supports --json option', async () => {
    mockApiRequest.mockResolvedValue([
      { service: 'API Gateway', status: 'operational', uptime: '99.99%', latency: '45ms', region: 'us-east-1' },
    ]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const program = createCLI();
    await program.parseAsync(['node', 'test', 'cloud', 'status', '--json']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
