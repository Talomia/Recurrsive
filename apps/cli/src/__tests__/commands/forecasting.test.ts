/**
 * Tests for the `recurrsive forecast` command.
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
        history: [{ date: '2026-07-01', score: 70 }, { date: '2026-07-08', score: 74 }],
        forecast: [{ date: '2026-07-14', predicted: 75, lowerBound: 74, upperBound: 76 }],
        regression: { slope: 0.5, intercept: 70, r2: 0.82 },
      },
      generatedAt: '2026-07-13T00:00:00.000Z',
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

  it('calls the implemented health endpoint with the requested horizon', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const program = createCLI();
    await program.parseAsync(['node', 'test', 'forecast', 'health', '--days', '14', '--json']);
    expect(mockApiRequest).toHaveBeenCalledWith('/api/v1/forecasting/health?horizon=14');
    spy.mockRestore();
  });
});
