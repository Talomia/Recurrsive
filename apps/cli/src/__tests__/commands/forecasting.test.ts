/**
 * Tests for the `recurrsive forecast` command.
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
  success: vi.fn(),
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

import { registerForecastCommand } from '../../commands/forecasting.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCLI(): Command {
  const program = new Command();
  program.exitOverride();
  registerForecastCommand(program);
  return program;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('forecast command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    mockApiRequest.mockResolvedValue({
      data: {
        currentScore: 74,
        trend: 'improving',
        confidence: 0.82,
        history: [{ date: '2026-06-01', score: 70 }],
        forecast: [{ date: '2026-07-01', predicted: 79, lowerBound: 72, upperBound: 86 }],
        targets: [{ target: 80, daysToReach: 20, reachable: true }],
      },
    });
  });

  it('registers the "forecast" command', () => {
    const program = createCLI();
    const cmd = program.commands.find((c) => c.name() === 'forecast');
    expect(cmd).toBeDefined();
  });

  it('has a "health" subcommand', () => {
    const program = createCLI();
    const forecast = program.commands.find((c) => c.name() === 'forecast')!;
    const sub = forecast.commands.find((c) => c.name() === 'health');
    expect(sub).toBeDefined();
  });

  it('has a "what-if" subcommand', () => {
    const program = createCLI();
    const forecast = program.commands.find((c) => c.name() === 'forecast')!;
    const sub = forecast.commands.find((c) => c.name() === 'what-if');
    expect(sub).toBeDefined();
  });

  it('health subcommand supports --json option', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const program = createCLI();
    await program.parseAsync(['node', 'test', 'forecast', 'health', '--json']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('health subcommand supports --days option', () => {
    const program = createCLI();
    const forecast = program.commands.find((c) => c.name() === 'forecast')!;
    const health = forecast.commands.find((c) => c.name() === 'health')!;
    const opt = health.options.find((o) => o.long === '--days');
    expect(opt).toBeDefined();
  });

  it('what-if subcommand posts actions and supports --json option', async () => {
    mockApiRequest.mockResolvedValue({
      data: {
        currentScore: 74,
        projectedScore: 82,
        totalImpact: 8,
        actions: [
          {
            type: 'fix-critical-findings',
            description: 'Fix critical findings',
            impact: { healthScoreDelta: 8, confidence: 0.9, timeToRealize: '7 days', affectedDimensions: ['security'] },
          },
        ],
        summary: { recommendation: 'Prioritize the highest-confidence actions.' },
      },
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const program = createCLI();
    await program.parseAsync(['node', 'test', 'forecast', 'what-if', 'fix-critical-findings', '--json']);
    expect(mockApiRequest).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/forecasting/what-if'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
