/**
 * Tests for JSON and SARIF report generation.
 */

import { describe, it, expect } from 'vitest';
import type { Opportunity } from '@recurrsive/core';
import { generateJsonReport } from '../../reports/json.js';
import { generateSarifReport } from '../../reports/sarif.js';
import { generateReport } from '../../reports/index.js';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeOpp(overrides: Partial<{
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  confidence: number;
  status: string;
  locations: Array<{ file: string; start_line?: number; end_line?: number }>;
  tags: string[];
}> = {}): Opportunity {
  const {
    id = crypto.randomUUID(),
    title = 'Test Opportunity',
    severity = 'medium',
    category = 'performance',
    confidence = 0.8,
    status = 'proposed',
    locations = [{ file: 'src/index.ts', start_line: 10, end_line: 20 }],
    tags = ['test'],
  } = overrides;

  return {
    id,
    title,
    type: 'opportunity',
    category,
    severity,
    problem: 'This is a test problem description.',
    evidence: [{
      id: crypto.randomUUID(),
      type: 'code',
      source: 'test-analyzer',
      description: 'Found in code analysis',
      entity_ids: [],
      collected_at: '2026-01-01T00:00:00.000Z',
      confidence: 0.9,
    }],
    recommendation: 'Apply the recommended fix.',
    expected_impact: {
      summary: 'Improved performance by 20%',
      metrics: [{ name: 'latency', current_value: 100, expected_value: 80, change_percent: -20, direction: 'decrease' }],
      affected_services: ['api-gateway'],
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
      steps: [{ description: 'Run unit tests', type: 'automated_test' }],
      success_criteria: ['All tests pass', 'No regression in latency'],
    },
    rollback: { strategy: 'manual', steps: ['Revert PR'] },
    reasoning: {
      proposer: 'analyzer-agent',
      supporters: [],
      dissenters: [],
      consensus_score: 0.9,
    },
    locations,
    related: [],
    status,
    tags,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  } as unknown as Opportunity;
}

// ---------------------------------------------------------------------------
// JSON Report
// ---------------------------------------------------------------------------

describe('generateJsonReport', () => {
  it('generates valid JSON', () => {
    const opps = [makeOpp()];
    const output = generateJsonReport(opps);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('includes $schema and version fields', () => {
    const output = generateJsonReport([]);
    const parsed = JSON.parse(output);
    expect(parsed.$schema).toBe('https://recurrsive.dev/schemas/report-v1.json');
    expect(parsed.version).toBe('1.0.0');
  });

  it('correctly counts severity distribution', () => {
    const opps = [
      makeOpp({ severity: 'critical' }),
      makeOpp({ severity: 'critical' }),
      makeOpp({ severity: 'high' }),
      makeOpp({ severity: 'medium' }),
      makeOpp({ severity: 'low' }),
      makeOpp({ severity: 'info' }),
    ];
    const parsed = JSON.parse(generateJsonReport(opps));
    expect(parsed.summary.severity_distribution).toEqual({
      critical: 2,
      high: 1,
      medium: 1,
      low: 1,
      info: 1,
    });
  });

  it('correctly counts category distribution', () => {
    const opps = [
      makeOpp({ category: 'security' }),
      makeOpp({ category: 'security' }),
      makeOpp({ category: 'performance' }),
    ];
    const parsed = JSON.parse(generateJsonReport(opps));
    expect(parsed.summary.category_distribution).toEqual({
      security: 2,
      performance: 1,
    });
  });

  it('respects maxItems option', () => {
    const opps = Array.from({ length: 10 }, (_, i) => makeOpp({ title: `Opp ${i}` }));
    const parsed = JSON.parse(generateJsonReport(opps, { maxItems: 3 }));

    // Only 3 opportunities should appear in the detailed list
    expect(parsed.opportunities).toHaveLength(3);
    // But total_opportunities in summary should still reflect all 10
    expect(parsed.summary.total_opportunities).toBe(10);
  });

  it('handles empty opportunities array', () => {
    const parsed = JSON.parse(generateJsonReport([]));
    expect(parsed.summary.total_opportunities).toBe(0);
    expect(parsed.opportunities).toHaveLength(0);
    expect(parsed.summary.severity_distribution).toEqual({
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    });
    expect(parsed.summary.category_distribution).toEqual({});
  });

  it('includes healthScore when provided', () => {
    const parsed = JSON.parse(generateJsonReport([], { healthScore: 85 }));
    expect(parsed.summary.health_score).toBe(85);
  });

  it('sets health_score to null when not provided', () => {
    const parsed = JSON.parse(generateJsonReport([]));
    expect(parsed.summary.health_score).toBeNull();
  });

  it('prettyPrint: false produces compact JSON', () => {
    const pretty = generateJsonReport([], { prettyPrint: true });
    const compact = generateJsonReport([], { prettyPrint: false });

    // Compact JSON should be shorter (no whitespace/newlines)
    expect(compact.length).toBeLessThan(pretty.length);
    // Compact JSON should not contain newlines
    expect(compact).not.toContain('\n');
    // Both should parse to equivalent structures
    expect(JSON.parse(compact).version).toBe(JSON.parse(pretty).version);
  });

  it('includes generated_at timestamp', () => {
    const parsed = JSON.parse(generateJsonReport([]));
    expect(parsed.generated_at).toBeDefined();
    // Should be a valid ISO-8601 timestamp
    expect(new Date(parsed.generated_at).toISOString()).toBe(parsed.generated_at);
  });

  it('uses default title when none provided', () => {
    const parsed = JSON.parse(generateJsonReport([]));
    expect(parsed.title).toBe('Recurrsive Analysis Report');
  });

  it('uses custom title when provided', () => {
    const parsed = JSON.parse(generateJsonReport([], { title: 'Sprint 42' }));
    expect(parsed.title).toBe('Sprint 42');
  });

  it('includes maturity scores when provided', () => {
    const maturity = [{
      dimension: 'security',
      level: 'defined',
      score: 72,
      trend: 'improving',
      evidence: ['Good test coverage'],
      recommendations: ['Add SAST scanning'],
    }];
    const parsed = JSON.parse(generateJsonReport([], { maturityScores: maturity as any }));
    expect(parsed.maturity).toHaveLength(1);
    expect(parsed.maturity[0].dimension).toBe('security');
  });

  it('maps opportunity fields correctly', () => {
    const opp = makeOpp({
      title: 'Fix Memory Leak',
      severity: 'high',
      category: 'performance',
      confidence: 0.95,
    });
    const parsed = JSON.parse(generateJsonReport([opp]));
    const item = parsed.opportunities[0];

    expect(item.title).toBe('Fix Memory Leak');
    expect(item.severity).toBe('high');
    expect(item.category).toBe('performance');
    expect(item.confidence).toBe(0.95);
    expect(item.problem).toBe('This is a test problem description.');
    expect(item.recommendation).toBe('Apply the recommended fix.');
    expect(item.effort.t_shirt).toBe('m');
    expect(item.effort.hours).toBe(8);
    expect(item.effort.skills).toEqual(['typescript']);
    expect(item.locations).toHaveLength(1);
    expect(item.locations[0].file).toBe('src/index.ts');
  });

  it('includes evidence by default', () => {
    const parsed = JSON.parse(generateJsonReport([makeOpp()]));
    expect(parsed.opportunities[0].evidence).toBeDefined();
    expect(parsed.opportunities[0].evidence).toHaveLength(1);
  });

  it('excludes evidence when includeEvidence is false', () => {
    const parsed = JSON.parse(generateJsonReport([makeOpp()], { includeEvidence: false }));
    expect(parsed.opportunities[0].evidence).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SARIF Report
// ---------------------------------------------------------------------------

describe('generateSarifReport', () => {
  it('generates valid SARIF JSON', () => {
    const opps = [makeOpp()];
    const output = generateSarifReport(opps);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('has the canonical OASIS $schema URL for SARIF v2.1.0', () => {
    const parsed = JSON.parse(generateSarifReport([]));
    expect(parsed.$schema).toBe(
      'https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json',
    );
    expect(parsed.version).toBe('2.1.0');
  });

  it('uses the full opportunity id in the rule id (no truncation collisions)', () => {
    const opp = makeOpp({ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', category: 'security' });
    const parsed = JSON.parse(generateSarifReport([opp]));
    const ruleId = parsed.runs[0].results[0].ruleId;
    expect(ruleId).toBe('recurrsive/security/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(parsed.runs[0].tool.driver.rules[0].id).toBe(ruleId);
  });

  it('distinct opportunities sharing an id prefix get distinct rule ids', () => {
    const a = makeOpp({ id: 'aaaaaaaa-1111-1111-1111-111111111111', category: 'security' });
    const b = makeOpp({ id: 'aaaaaaaa-2222-2222-2222-222222222222', category: 'security' });
    const parsed = JSON.parse(generateSarifReport([a, b]));
    const ids = parsed.runs[0].tool.driver.rules.map((r: { id: string }) => r.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('falls back to the rule id when the sanitized rule name is empty', () => {
    const opp = makeOpp({ id: 'opp-1', title: '!!!???***', category: 'security' });
    const parsed = JSON.parse(generateSarifReport([opp]));
    const rule = parsed.runs[0].tool.driver.rules[0];
    expect(rule.name).toBe('recurrsive/security/opp-1');
  });

  describe('severity to SARIF level mapping', () => {
    it('maps critical to error', () => {
      const parsed = JSON.parse(generateSarifReport([makeOpp({ severity: 'critical' })]));
      expect(parsed.runs[0].results[0].level).toBe('error');
    });

    it('maps high to error', () => {
      const parsed = JSON.parse(generateSarifReport([makeOpp({ severity: 'high' })]));
      expect(parsed.runs[0].results[0].level).toBe('error');
    });

    it('maps medium to warning', () => {
      const parsed = JSON.parse(generateSarifReport([makeOpp({ severity: 'medium' })]));
      expect(parsed.runs[0].results[0].level).toBe('warning');
    });

    it('maps low to note', () => {
      const parsed = JSON.parse(generateSarifReport([makeOpp({ severity: 'low' })]));
      expect(parsed.runs[0].results[0].level).toBe('note');
    });

    it('maps info to note', () => {
      const parsed = JSON.parse(generateSarifReport([makeOpp({ severity: 'info' })]));
      expect(parsed.runs[0].results[0].level).toBe('note');
    });
  });

  it('includes tool driver info', () => {
    const parsed = JSON.parse(generateSarifReport([]));
    const driver = parsed.runs[0].tool.driver;
    expect(driver.name).toBe('Recurrsive');
    expect(driver.version).toBeDefined();
    expect(driver.informationUri).toBe('https://github.com/Talomia/Recurrsive');
  });

  it('creates locations from opportunity locations', () => {
    const opp = makeOpp({
      locations: [{ file: 'src/app.ts', start_line: 5, end_line: 15 }],
    });
    const parsed = JSON.parse(generateSarifReport([opp]));
    const locs = parsed.runs[0].results[0].locations;

    expect(locs).toHaveLength(1);
    expect(locs[0].physicalLocation.artifactLocation.uri).toBe('src/app.ts');
    expect(locs[0].physicalLocation.region.startLine).toBe(5);
    expect(locs[0].physicalLocation.region.endLine).toBe(15);
  });

  it('handles opportunities with no locations', () => {
    const opp = makeOpp({ locations: [] });
    const parsed = JSON.parse(generateSarifReport([opp]));
    const locs = parsed.runs[0].results[0].locations;

    // Should fall back to a generic 'project' location
    expect(locs).toHaveLength(1);
    expect(locs[0].physicalLocation.artifactLocation.uri).toBe('project');
  });

  it('handles empty opportunities array', () => {
    const parsed = JSON.parse(generateSarifReport([]));
    expect(parsed.runs).toHaveLength(1);
    expect(parsed.runs[0].results).toHaveLength(0);
    expect(parsed.runs[0].tool.driver.rules).toHaveLength(0);
  });

  it('includes invocation info', () => {
    const parsed = JSON.parse(generateSarifReport([]));
    const invocations = parsed.runs[0].invocations;
    expect(invocations).toHaveLength(1);
    expect(invocations[0].executionSuccessful).toBe(true);
    expect(invocations[0].startTimeUtc).toBeDefined();
    expect(invocations[0].endTimeUtc).toBeDefined();
  });

  it('creates rule descriptors for each opportunity', () => {
    const opps = [
      makeOpp({ title: 'Rule A', category: 'security' }),
      makeOpp({ title: 'Rule B', category: 'performance' }),
    ];
    const parsed = JSON.parse(generateSarifReport(opps));
    const rules = parsed.runs[0].tool.driver.rules;
    expect(rules).toHaveLength(2);
    expect(rules[0].shortDescription.text).toBe('This is a test problem description.');
    expect(rules[0].properties.category).toBe('security');
    expect(rules[1].properties.category).toBe('performance');
  });

  it('includes message with problem and recommendation', () => {
    const parsed = JSON.parse(generateSarifReport([makeOpp()]));
    const message = parsed.runs[0].results[0].message.text;
    expect(message).toContain('This is a test problem description.');
    expect(message).toContain('Apply the recommended fix.');
  });

  it('respects maxItems option', () => {
    const opps = Array.from({ length: 10 }, () => makeOpp());
    const parsed = JSON.parse(generateSarifReport(opps, { maxItems: 3 }));
    expect(parsed.runs[0].results).toHaveLength(3);
    expect(parsed.runs[0].tool.driver.rules).toHaveLength(3);
  });

  it('handles location with start_line but no end_line', () => {
    const opp = makeOpp({
      locations: [{ file: 'src/utils.ts', start_line: 42 }],
    });
    const parsed = JSON.parse(generateSarifReport([opp]));
    const region = parsed.runs[0].results[0].locations[0].physicalLocation.region;
    expect(region.startLine).toBe(42);
    // end_line should fall back to start_line
    expect(region.endLine).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// generateReport factory
// ---------------------------------------------------------------------------

describe('generateReport', () => {
  it('returns JSON when format="json"', () => {
    const result = generateReport([makeOpp()], 'json');
    const parsed = JSON.parse(result);
    expect(parsed.$schema).toBe('https://recurrsive.dev/schemas/report-v1.json');
    expect(parsed.version).toBe('1.0.0');
  });

  it('returns SARIF when format="sarif"', () => {
    const result = generateReport([makeOpp()], 'sarif');
    const parsed = JSON.parse(result);
    expect(parsed.$schema).toContain('sarif-schema-2.1.0.json');
    expect(parsed.version).toBe('2.1.0');
  });

  it('returns markdown when format="markdown"', () => {
    const result = generateReport([], 'markdown');
    expect(result).toContain('# Recurrsive Analysis Report');
  });

  it('returns HTML when format="html"', () => {
    const result = generateReport([], 'html');
    expect(result).toContain('<!DOCTYPE html>');
  });

  it('passes options through to JSON generator', () => {
    const result = generateReport([makeOpp()], 'json', {
      healthScore: 92,
      prettyPrint: false,
    });
    const parsed = JSON.parse(result);
    expect(parsed.summary.health_score).toBe(92);
    // Compact output should have no newlines
    expect(result).not.toContain('\n');
  });

  it('passes maxItems through to SARIF generator', () => {
    const opps = Array.from({ length: 10 }, () => makeOpp());
    const result = generateReport(opps, 'sarif', { maxItems: 2 });
    const parsed = JSON.parse(result);
    expect(parsed.runs[0].results).toHaveLength(2);
  });
});
