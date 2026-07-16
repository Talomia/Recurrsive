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
    // Default: a benchmark report envelope.
    mockApiRequest.mockResolvedValue({
      data: {
        industry: 'all',
        sampleSize: 3,
        percentiles: { p25: 60, p50: 70, p75: 80, p90: 90 },
        dimensionAverages: { security: 72 },
        topImprovementAreas: ['security'],
      },
    });
  });

  it('registers the "cloud" command', () => {
    const program = createCLI();
    const cmd = program.commands.find((c) => c.name() === 'cloud');
    expect(cmd).toBeDefined();
  });

  it('has a "benchmarks" subcommand', () => {
    const program = createCLI();
    const cloud = program.commands.find((c) => c.name() === 'cloud')!;
    expect(cloud.commands.find((c) => c.name() === 'benchmarks')).toBeDefined();
  });

  it('has a "patterns" subcommand', () => {
    const program = createCLI();
    const cloud = program.commands.find((c) => c.name() === 'cloud')!;
    expect(cloud.commands.find((c) => c.name() === 'patterns')).toBeDefined();
  });

  it('has a "partners" subcommand', () => {
    const program = createCLI();
    const cloud = program.commands.find((c) => c.name() === 'cloud')!;
    expect(cloud.commands.find((c) => c.name() === 'partners')).toBeDefined();
  });

  it('has a "services" subcommand', () => {
    const program = createCLI();
    const cloud = program.commands.find((c) => c.name() === 'cloud')!;
    expect(cloud.commands.find((c) => c.name() === 'services')).toBeDefined();
  });

  it('benchmarks subcommand hits the report endpoint with --json', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const program = createCLI();
    await program.parseAsync(['node', 'test', 'cloud', 'benchmarks', '--json']);
    expect(mockApiRequest).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/cloud/benchmarks/report'),
    );
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('services subcommand supports --json option', async () => {
    mockApiRequest.mockResolvedValue({
      data: [
        { id: 'ms-starter', name: 'Starter', description: 'x', tier: 'starter', features: [], priceRange: '$99/mo', sla: '99.5%' },
      ],
      total: 1,
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const program = createCLI();
    await program.parseAsync(['node', 'test', 'cloud', 'services', '--json']);
    expect(mockApiRequest).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/cloud/services'),
    );
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('partners subcommand hits the /partners endpoint', async () => {
    mockApiRequest.mockResolvedValue({ data: [], total: 0 });
    const program = createCLI();
    await program.parseAsync(['node', 'test', 'cloud', 'partners', '--json']);
    expect(mockApiRequest).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/partners'),
    );
  });
});
