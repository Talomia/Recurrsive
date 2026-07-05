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
      currentHealth: 74,
      predictedHealth: 79,
      trend: 'improving',
      confidenceLow: 72,
      confidenceHigh: 86,
      margin: 7,
      factors: ['Reduced complexity'],
      weekly: [{ week: 'Week 1', predicted: 76, confidence: '72-80', trend: 'improving' }],
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

  it('what-if subcommand supports --json option', async () => {
    mockApiRequest.mockResolvedValue([
      { id: 'a1', name: 'Fix critical bugs', impact: 5, effort: 'M', confidence: 85, category: 'Quality' },
    ]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const program = createCLI();
    await program.parseAsync(['node', 'test', 'forecast', 'what-if', '--json']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
