/**
 * Unit tests for the `recurrsive report` command.
 *
 * Tests cover:
 * - Generates markdown report (stdout by default)
 * - Generates json report (file by default)
 * - Generates sarif report (file by default)
 * - Generates html report (file by default)
 * - Handles --output flag to save to a specific file
 * - Handles no analysis results (no findings, no opportunities)
 * - Handles invalid format
 * - Calls banner and header
 * - Custom --title option
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock external dependencies
// ---------------------------------------------------------------------------

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('[]'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config/loader.js', () => ({
  loadConfig: vi.fn(),
}));

const mockManagerInstance = {
  load: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockReturnValue([]),
};

vi.mock('@recurrsive/opportunities', () => ({
  OpportunityManager: vi.fn().mockImplementation(() => mockManagerInstance),
}));

vi.mock('@recurrsive/presentation', () => ({
  generateMarkdownReport: vi.fn().mockReturnValue('# Markdown Report'),
  generateHtmlReport: vi.fn().mockReturnValue('<html>Report</html>'),
  generateSarifReport: vi.fn().mockReturnValue('{"$schema": "sarif"}'),
  generateJsonReport: vi.fn().mockReturnValue('{"report": true}'),
}));

vi.mock('../../output/terminal.js', () => ({
  banner: vi.fn(),
  header: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  bold: vi.fn((t: string) => t),
  cyan: vi.fn((t: string) => t),
  dim: vi.fn((t: string) => t),
  magenta: vi.fn((t: string) => t),
  table: vi.fn((_h: string[], _r: string[][]) => 'table'),
  severityColor: vi.fn((s: string) => s),
}));

// ---------------------------------------------------------------------------
// Imports (AFTER mocks)
// ---------------------------------------------------------------------------

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { loadConfig } from '../../config/loader.js';
import {
  generateMarkdownReport,
  generateHtmlReport,
  generateSarifReport,
  generateJsonReport,
} from '@recurrsive/presentation';
import { registerReportCommand } from '../../commands/report.js';
import {
  banner,
  header,
  success,
  error as termError,
  info,
} from '../../output/terminal.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default loadConfig mock return value. */
const defaultConfigResult = {
  config: {
    output: { directory: '.recurrsive' },
    project: { name: 'test-project' },
    graph: { provider: 'sqlite' as const },
  },
  configPath: '/project/.recurrsive/config.json',
  projectRoot: '/project',
};

/** Sample findings data. */
const sampleFindings = [
  {
    id: 'f-1',
    title: 'Security Issue',
    severity: 'high',
    category: 'security',
    confidence: 0.9,
    description: 'A security issue',
    locations: [],
  },
  {
    id: 'f-2',
    title: 'Performance Issue',
    severity: 'medium',
    category: 'performance',
    confidence: 0.7,
    description: 'A performance issue',
    locations: [],
  },
];

/** Sample opportunities data. */
const sampleOpportunities = [
  {
    id: 'opp-1',
    title: 'Improve Architecture',
    type: 'opportunity',
    category: 'architecture',
    severity: 'medium',
    confidence: 0.8,
    status: 'proposed',
  },
];

/**
 * Create a fake Commander program that captures the action handler
 * for the `report` command.
 */
function createFakeProgram() {
  let actionHandler:
    | ((opts: Record<string, unknown>) => Promise<void>)
    | null = null;

  const commandChain = {
    description: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    action: vi.fn((fn: typeof actionHandler) => {
      actionHandler = fn;
      return commandChain;
    }),
  };

  const program = {
    command: vi.fn().mockReturnValue(commandChain),
  };

  registerReportCommand(program as any);

  return {
    program,
    commandChain,
    runAction: (opts: Record<string, unknown> = {}) => {
      if (!actionHandler) throw new Error('action not registered');
      const mergedOpts = {
        format: 'markdown',
        ...opts,
      };
      return actionHandler(mergedOpts);
    },
  };
}

/**
 * Configure mocks so the report command can load findings and opportunities.
 *
 * @param withFindings - Whether findings.json should exist.
 * @param withOpps - Whether opportunities.json should exist.
 */
function setupData(withFindings = true, withOpps = true) {
  (existsSync as Mock).mockImplementation((path: string) => {
    if (path.includes('findings.json')) return withFindings;
    if (path.includes('opportunities.json')) return withOpps;
    return false;
  });

  if (withFindings) {
    (readFile as Mock).mockResolvedValue(JSON.stringify(sampleFindings));
  } else {
    (readFile as Mock).mockResolvedValue('[]');
  }

  if (withOpps) {
    mockManagerInstance.list.mockReturnValue(sampleOpportunities);
  } else {
    mockManagerInstance.list.mockReturnValue([]);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerReportCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (loadConfig as Mock).mockResolvedValue(defaultConfigResult);
    setupData(true, true);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  // ── Command Registration ───────────────────────────────────────────────

  describe('command registration', () => {
    it('registers the "report" command', () => {
      const { program } = createFakeProgram();
      expect(program.command).toHaveBeenCalledWith('report');
    });

    it('has --format option with default "markdown"', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.option).toHaveBeenCalledWith(
        '--format <format>',
        expect.any(String),
        'markdown',
      );
    });

    it('has --output option', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.option).toHaveBeenCalledWith(
        '--output <path>',
        expect.any(String),
      );
    });

    it('has --title option', () => {
      const { commandChain } = createFakeProgram();
      expect(commandChain.option).toHaveBeenCalledWith(
        '--title <title>',
        expect.any(String),
      );
    });
  });

  // ── Banner / Header ───────────────────────────────────────────────────

  describe('chrome', () => {
    it('calls banner() and header()', async () => {
      const { runAction } = createFakeProgram();
      await runAction();

      expect(banner).toHaveBeenCalled();
      expect(header).toHaveBeenCalledWith('Report Generation');
    });
  });

  // ── Markdown Report ───────────────────────────────────────────────────

  describe('markdown report', () => {
    it('generates markdown report and outputs to stdout', async () => {
      const { runAction } = createFakeProgram();
      await runAction({ format: 'markdown' });

      expect(generateMarkdownReport).toHaveBeenCalledWith(
        sampleOpportunities,
        expect.objectContaining({
          title: expect.any(String),
          includeActionItems: true,
        }),
      );
      // Markdown with no --output goes to console.log
      expect(consoleSpy).toHaveBeenCalledWith('# Markdown Report');
    });

    it('does not call writeFile when format is markdown and no --output', async () => {
      const { runAction } = createFakeProgram();
      await runAction({ format: 'markdown' });

      expect(writeFile).not.toHaveBeenCalled();
    });
  });

  // ── JSON Report ───────────────────────────────────────────────────────

  describe('json report', () => {
    it('generates json report and saves to file', async () => {
      const { runAction } = createFakeProgram();
      await runAction({ format: 'json' });

      expect(generateJsonReport).toHaveBeenCalledWith(
        sampleOpportunities,
        expect.objectContaining({
          title: expect.any(String),
          includeEvidence: true,
        }),
      );
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('report.json'),
        '{"report": true}',
        'utf-8',
      );
      expect(success).toHaveBeenCalledWith(
        expect.stringContaining('Report saved'),
      );
    });
  });

  // ── SARIF Report ──────────────────────────────────────────────────────

  describe('sarif report', () => {
    it('generates sarif report and saves to file', async () => {
      const { runAction } = createFakeProgram();
      await runAction({ format: 'sarif' });

      expect(generateSarifReport).toHaveBeenCalledWith(
        sampleOpportunities,
        expect.objectContaining({ title: expect.any(String) }),
      );
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('report.sarif.json'),
        '{"$schema": "sarif"}',
        'utf-8',
      );
    });
  });

  // ── HTML Report ───────────────────────────────────────────────────────

  describe('html report', () => {
    it('generates html report and saves to file', async () => {
      const { runAction } = createFakeProgram();
      await runAction({ format: 'html' });

      expect(generateHtmlReport).toHaveBeenCalledWith(
        sampleOpportunities,
        expect.objectContaining({ title: expect.any(String) }),
      );
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('report.html'),
        '<html>Report</html>',
        'utf-8',
      );
    });
  });

  // ── --output Flag ─────────────────────────────────────────────────────

  describe('--output flag', () => {
    it('saves markdown report to explicit output path', async () => {
      const { runAction } = createFakeProgram();
      await runAction({ format: 'markdown', output: '/tmp/my-report.md' });

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/my-report.md'),
        '# Markdown Report',
        'utf-8',
      );
      expect(success).toHaveBeenCalledWith(
        expect.stringContaining('Report saved'),
      );
    });

    it('saves json report to explicit output path', async () => {
      const { runAction } = createFakeProgram();
      await runAction({ format: 'json', output: '/tmp/report.json' });

      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/report.json'),
        '{"report": true}',
        'utf-8',
      );
    });
  });

  // ── No Analysis Results ───────────────────────────────────────────────

  describe('no analysis results', () => {
    it('shows error when no findings and no opportunities exist', async () => {
      setupData(false, false);

      const { runAction } = createFakeProgram();
      await runAction();

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('No analysis results found'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('suggests running analyze first', async () => {
      setupData(false, false);

      const { runAction } = createFakeProgram();
      await runAction();

      expect(info).toHaveBeenCalledWith(
        expect.stringContaining('Expected data in'),
      );
    });
  });

  // ── Invalid Format ────────────────────────────────────────────────────

  describe('invalid format', () => {
    it('shows error for unsupported format', async () => {
      const { runAction } = createFakeProgram();
      await runAction({ format: 'xml' });

      expect(termError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid format'),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── Custom Title ──────────────────────────────────────────────────────

  describe('custom title', () => {
    it('passes custom title to report generator', async () => {
      const { runAction } = createFakeProgram();
      await runAction({ format: 'markdown', title: 'My Custom Report' });

      expect(generateMarkdownReport).toHaveBeenCalledWith(
        sampleOpportunities,
        expect.objectContaining({ title: 'My Custom Report' }),
      );
    });

    it('uses default title when --title not specified', async () => {
      const { runAction } = createFakeProgram();
      await runAction({ format: 'markdown' });

      expect(generateMarkdownReport).toHaveBeenCalledWith(
        sampleOpportunities,
        expect.objectContaining({
          title: 'Recurrsive Analysis Report',
        }),
      );
    });
  });

  // ── Data Summary ──────────────────────────────────────────────────────

  describe('data summary', () => {
    it('displays findings and opportunities counts', async () => {
      const { runAction } = createFakeProgram();
      await runAction();

      // The command logs finding count and opportunity count
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(String(sampleFindings.length)),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(String(sampleOpportunities.length)),
      );
    });

    it('generates report with only findings (no opportunities)', async () => {
      setupData(true, false);

      const { runAction } = createFakeProgram();
      await runAction();

      // Should still generate the report (not exit) since findings exist
      expect(generateMarkdownReport).toHaveBeenCalled();
    });

    it('generates report with only opportunities (no findings)', async () => {
      setupData(false, true);

      const { runAction } = createFakeProgram();
      await runAction();

      expect(generateMarkdownReport).toHaveBeenCalled();
    });
  });
});
