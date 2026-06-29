/**
 * Tests for terminal formatters.
 */

import { describe, it, expect } from 'vitest';
import type { Opportunity, MaturityScore } from '@recurrsive/core';
import {
  formatTable,
  formatProgressBar,
  formatHealthScore,
  formatOpportunities,
  formatOpportunityDetail,
} from '../../formatters/terminal.js';

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

/** Strip ANSI escape codes for content assertions. */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeOpp(overrides: Partial<{
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  confidence: number;
}> = {}): Opportunity {
  const {
    id = crypto.randomUUID(),
    title = 'Test Opportunity',
    severity = 'medium',
    category = 'performance',
    confidence = 0.8,
  } = overrides;

  return {
    id,
    title,
    type: 'opportunity',
    category,
    severity,
    problem: 'This is a test problem.',
    evidence: [{
      id: crypto.randomUUID(),
      type: 'code',
      source: 'test',
      description: 'Evidence item from code analysis that found an issue.',
      entity_ids: [],
      collected_at: '2026-01-01T00:00:00.000Z',
      confidence: 0.9,
    }],
    recommendation: 'Fix the identified issue.',
    expected_impact: {
      summary: 'Improved reliability',
      metrics: [{ name: 'uptime', current_value: '99.5%', expected_value: '99.9%', change_percent: 0.4 }],
      affected_services: ['api'],
    },
    confidence,
    effort: {
      t_shirt: 'm',
      estimated_hours: 8,
      skills_required: ['typescript'],
      dependencies: [],
    },
    risk: {
      level: 'low',
      description: 'Low risk change',
      mitigations: ['Code review'],
    },
    validation: {
      steps: [{ description: 'Run unit tests', type: 'automated_test', duration: '5m' }],
      success_criteria: ['All tests pass'],
    },
    rollback: { strategy: 'manual', steps: ['Revert'] },
    reasoning: {
      proposer: 'agent-1',
      supporters: [],
      dissenters: [],
      consensus_score: 0.9,
    },
    locations: [{ file: 'src/index.ts', start_line: 10, end_line: 20 }],
    related: [],
    status: 'proposed',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  } as unknown as Opportunity;
}

// ---------------------------------------------------------------------------
// formatTable tests
// ---------------------------------------------------------------------------

describe('formatTable', () => {
  it('produces aligned columns', () => {
    const headers = ['Name', 'Age', 'City'];
    const rows = [
      ['Alice', '30', 'New York'],
      ['Bob', '25', 'San Francisco'],
    ];
    const table = formatTable(headers, rows);
    const lines = table.split('\n');

    // Should have: top border, header, mid border, 2 data rows, bottom border = 6 lines
    expect(lines).toHaveLength(6);

    // Check alignment by verifying the borders match up
    const topBorder = lines[0]!;
    const midBorder = lines[2]!;
    const botBorder = lines[5]!;

    // All border lines should have the same visible width
    expect(topBorder.length).toBe(midBorder.length);
    expect(midBorder.length).toBe(botBorder.length);
  });

  it('uses box-drawing characters for borders', () => {
    const table = formatTable(['A'], [['B']]);
    expect(table).toContain('┌');
    expect(table).toContain('┐');
    expect(table).toContain('├');
    expect(table).toContain('┤');
    expect(table).toContain('└');
    expect(table).toContain('┘');
    expect(table).toContain('│');
    expect(table).toContain('─');
  });

  it('renders header in bold', () => {
    const table = formatTable(['Title'], [['Value']]);
    expect(table).toContain(BOLD);
  });

  it('handles empty rows', () => {
    const table = formatTable(['A', 'B'], []);
    const lines = table.split('\n');
    // top border + header + mid border + bottom border = 4 lines
    expect(lines).toHaveLength(4);
  });

  it('handles cells wider than header', () => {
    const table = formatTable(['X'], [['A very long value here']]);
    const clean = stripAnsi(table);
    // The column should be wide enough for the data
    expect(clean).toContain('A very long value here');
  });

  it('handles header wider than data', () => {
    const table = formatTable(['Very Long Header'], [['x']]);
    const clean = stripAnsi(table);
    expect(clean).toContain('Very Long Header');
    expect(clean).toContain('x');
  });

  it('handles ANSI-colored cells for width calculation', () => {
    const coloredCell = `\x1b[31mRed Text\x1b[0m`;
    const table = formatTable(['Col'], [[coloredCell]]);
    // Should not crash and should produce valid output
    expect(table).toContain('Red Text');
  });

  it('handles multiple columns correctly', () => {
    const headers = ['A', 'B', 'C', 'D'];
    const rows = [['1', '2', '3', '4']];
    const table = formatTable(headers, rows);

    // Count column separators (│) in the header row
    const headerLine = table.split('\n')[1]!;
    const pipes = (headerLine.match(/│/g) ?? []).length;
    // Should have headers.length + 1 pipes (left + separators + right)
    expect(pipes).toBe(headers.length + 1);
  });
});

// ---------------------------------------------------------------------------
// formatProgressBar tests
// ---------------------------------------------------------------------------

describe('formatProgressBar', () => {
  it('shows 100% for current == total', () => {
    const bar = formatProgressBar(100, 100);
    const clean = stripAnsi(bar);
    expect(clean).toContain('100%');
  });

  it('shows 0% for current == 0', () => {
    const bar = formatProgressBar(0, 100);
    const clean = stripAnsi(bar);
    expect(clean).toContain('0%');
  });

  it('shows 50% for half progress', () => {
    const bar = formatProgressBar(50, 100);
    const clean = stripAnsi(bar);
    expect(clean).toContain('50%');
  });

  it('shows correct percentage for arbitrary values', () => {
    const bar = formatProgressBar(7, 10);
    const clean = stripAnsi(bar);
    expect(clean).toContain('70%');
  });

  it('caps at 100% when current > total', () => {
    const bar = formatProgressBar(150, 100);
    const clean = stripAnsi(bar);
    expect(clean).toContain('100%');
  });

  it('shows 0% when total is 0', () => {
    const bar = formatProgressBar(0, 0);
    const clean = stripAnsi(bar);
    expect(clean).toContain('0%');
  });

  it('uses filled blocks (█) for progress', () => {
    const bar = formatProgressBar(50, 100);
    expect(bar).toContain('█');
  });

  it('uses empty blocks (░) for remaining', () => {
    const bar = formatProgressBar(50, 100);
    expect(bar).toContain('░');
  });

  it('respects custom width parameter', () => {
    const bar = formatProgressBar(50, 100, 20);
    // 50% of 20 = 10 filled + 10 empty = 20 chars of bar
    const blocks = bar.match(/[█░]/g) ?? [];
    expect(blocks).toHaveLength(20);
  });

  it('uses green color for high percentage (>= 75%)', () => {
    const bar = formatProgressBar(80, 100);
    expect(bar).toContain('\x1b[32m'); // FG_GREEN
  });

  it('uses yellow color for medium percentage (>= 50%)', () => {
    const bar = formatProgressBar(60, 100);
    expect(bar).toContain('\x1b[33m'); // FG_YELLOW
  });

  it('uses red color for low percentage (< 50%)', () => {
    const bar = formatProgressBar(30, 100);
    expect(bar).toContain('\x1b[31m'); // FG_RED
  });

  it('contains RESET escape code', () => {
    const bar = formatProgressBar(50, 100);
    expect(bar).toContain(RESET);
  });
});

// ---------------------------------------------------------------------------
// formatHealthScore tests
// ---------------------------------------------------------------------------

describe('formatHealthScore', () => {
  it('includes the score value in the output', () => {
    const output = formatHealthScore(78);
    const clean = stripAnsi(output);
    expect(clean).toContain('78%');
  });

  it('contains PROJECT HEALTH DASHBOARD heading', () => {
    const output = formatHealthScore(50);
    const clean = stripAnsi(output);
    expect(clean).toContain('PROJECT HEALTH DASHBOARD');
  });

  it('contains Health Score label', () => {
    const output = formatHealthScore(50);
    const clean = stripAnsi(output);
    expect(clean).toContain('Health Score');
  });

  it('shows Excellent status for score >= 90', () => {
    const output = formatHealthScore(95);
    const clean = stripAnsi(output);
    expect(clean).toContain('Excellent');
  });

  it('shows Good status for score >= 75', () => {
    const output = formatHealthScore(80);
    const clean = stripAnsi(output);
    expect(clean).toContain('Good');
  });

  it('shows Fair status for score >= 60', () => {
    const output = formatHealthScore(65);
    const clean = stripAnsi(output);
    expect(clean).toContain('Fair');
  });

  it('shows Needs Attention status for score >= 40', () => {
    const output = formatHealthScore(45);
    const clean = stripAnsi(output);
    expect(clean).toContain('Needs Attention');
  });

  it('shows Critical status for score < 40', () => {
    const output = formatHealthScore(20);
    const clean = stripAnsi(output);
    expect(clean).toContain('Critical');
  });

  it('includes progress bar', () => {
    const output = formatHealthScore(50);
    expect(output).toContain('█');
    expect(output).toContain('░');
  });

  it('includes maturity scores when provided', () => {
    const maturity: MaturityScore[] = [{
      dimension: 'security',
      level: 'defined',
      score: 72,
      trend: 'improving',
      evidence: [],
      recommendations: [],
    }];
    const output = formatHealthScore(78, maturity);
    const clean = stripAnsi(output);

    expect(clean).toContain('Maturity Scores');
    expect(clean).toContain('security');
    expect(clean).toContain('defined');
  });

  it('shows trend arrows in maturity display', () => {
    const maturity: MaturityScore[] = [
      {
        dimension: 'security',
        level: 'managed',
        score: 85,
        trend: 'improving',
        evidence: [],
        recommendations: [],
      },
      {
        dimension: 'testing',
        level: 'initial',
        score: 25,
        trend: 'declining',
        evidence: [],
        recommendations: [],
      },
      {
        dimension: 'architecture',
        level: 'defined',
        score: 60,
        trend: 'stable',
        evidence: [],
        recommendations: [],
      },
    ];
    const output = formatHealthScore(70, maturity);
    // Trend icons: ↑ (improving), ↓ (declining), → (stable)
    expect(output).toContain('↑');
    expect(output).toContain('↓');
    expect(output).toContain('→');
  });

  it('omits maturity section when not provided', () => {
    const output = formatHealthScore(50);
    const clean = stripAnsi(output);
    expect(clean).not.toContain('Maturity Scores');
  });
});

// ---------------------------------------------------------------------------
// formatOpportunities tests
// ---------------------------------------------------------------------------

describe('formatOpportunities', () => {
  it('returns "No opportunities" message for empty array', () => {
    const output = formatOpportunities([]);
    const clean = stripAnsi(output);
    expect(clean).toContain('No opportunities to display');
  });

  it('renders a table with severity, title, category, confidence, and effort columns', () => {
    const opp = makeOpp({ title: 'Fix Bug', severity: 'high', category: 'security', confidence: 0.75 });
    const output = formatOpportunities([opp]);
    const clean = stripAnsi(output);

    expect(clean).toContain('Severity');
    expect(clean).toContain('Title');
    expect(clean).toContain('Category');
    expect(clean).toContain('Confidence');
    expect(clean).toContain('Effort');
    expect(clean).toContain('Fix Bug');
    expect(clean).toContain('security');
    expect(clean).toContain('75%');
    expect(clean).toContain('M');
  });

  it('truncates long titles to 50 chars', () => {
    const longTitle = 'A'.repeat(60);
    const opp = makeOpp({ title: longTitle });
    const output = formatOpportunities([opp]);
    const clean = stripAnsi(output);
    expect(clean).toContain('...');
    expect(clean).not.toContain(longTitle);
  });

  it('includes severity icons', () => {
    const opp = makeOpp({ severity: 'critical' });
    const output = formatOpportunities([opp]);
    const clean = stripAnsi(output);
    expect(clean).toContain('✘');
  });
});

// ---------------------------------------------------------------------------
// formatOpportunityDetail tests
// ---------------------------------------------------------------------------

describe('formatOpportunityDetail', () => {
  it('includes the opportunity title', () => {
    const opp = makeOpp({ title: 'Fix Memory Leak' });
    const output = formatOpportunityDetail(opp);
    const clean = stripAnsi(output);
    expect(clean).toContain('Fix Memory Leak');
  });

  it('includes key fields (ID, Type, Category, Severity, Status)', () => {
    const opp = makeOpp({ category: 'security', severity: 'high' });
    const output = formatOpportunityDetail(opp);
    const clean = stripAnsi(output);

    expect(clean).toContain('ID');
    expect(clean).toContain('Type');
    expect(clean).toContain('Category');
    expect(clean).toContain('Severity');
    expect(clean).toContain('Status');
    expect(clean).toContain('security');
    expect(clean).toContain('high');
  });

  it('includes Problem and Recommendation sections', () => {
    const opp = makeOpp();
    const output = formatOpportunityDetail(opp);
    const clean = stripAnsi(output);

    expect(clean).toContain('Problem');
    expect(clean).toContain('Recommendation');
    expect(clean).toContain('This is a test problem');
    expect(clean).toContain('Fix the identified issue');
  });

  it('includes Expected Impact section', () => {
    const opp = makeOpp();
    const output = formatOpportunityDetail(opp);
    const clean = stripAnsi(output);
    expect(clean).toContain('Expected Impact');
    expect(clean).toContain('Improved reliability');
  });

  it('includes Evidence section with count', () => {
    const opp = makeOpp();
    const output = formatOpportunityDetail(opp);
    const clean = stripAnsi(output);
    expect(clean).toContain('Evidence (1)');
  });

  it('includes Locations section', () => {
    const opp = makeOpp();
    const output = formatOpportunityDetail(opp);
    const clean = stripAnsi(output);
    expect(clean).toContain('Locations');
    expect(clean).toContain('src/index.ts');
  });

  it('includes Validation Plan section', () => {
    const opp = makeOpp();
    const output = formatOpportunityDetail(opp);
    const clean = stripAnsi(output);
    expect(clean).toContain('Validation Plan');
    expect(clean).toContain('Run unit tests');
    expect(clean).toContain('Success criteria');
    expect(clean).toContain('All tests pass');
  });

  it('renders confidence as percentage', () => {
    const opp = makeOpp({ confidence: 0.85 });
    const output = formatOpportunityDetail(opp);
    const clean = stripAnsi(output);
    expect(clean).toContain('85%');
  });

  it('renders effort with t-shirt size', () => {
    const opp = makeOpp();
    const output = formatOpportunityDetail(opp);
    const clean = stripAnsi(output);
    expect(clean).toContain('M');
  });
});
