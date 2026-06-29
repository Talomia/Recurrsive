/**
 * Tests for SARIF export.
 */

import { describe, it, expect } from 'vitest';
import type { Opportunity } from '@recurrsive/core';
import { exportToSarif } from '../sarif.js';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeOpp(overrides: Partial<{
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  type: string;
  file: string;
  start_line?: number;
  end_line?: number;
}> = {}): Opportunity {
  const {
    id = '00000000-0000-0000-0000-000000000001',
    title = 'Test Finding',
    severity = 'medium',
    category = 'performance',
    type = 'opportunity',
    file = 'src/index.ts',
    start_line = 10,
    end_line = 20,
  } = overrides;

  return {
    id,
    title,
    type,
    category,
    severity,
    problem: 'Test problem',
    evidence: [{
      id: crypto.randomUUID(),
      type: 'code',
      source: 'test',
      description: 'Evidence',
      entity_ids: [],
      collected_at: '2026-01-01T00:00:00.000Z',
      confidence: 0.9,
    }],
    recommendation: 'Fix it',
    expected_impact: {
      summary: 'Some impact',
      metrics: [],
      affected_services: ['svc-a'],
    },
    confidence: 0.8,
    effort: {
      t_shirt: 'm',
      estimated_hours: 8,
      skills_required: [],
      dependencies: [],
    },
    risk: {
      level: 'low',
      description: 'Low risk',
      mitigations: [],
    },
    validation: { steps: [], success_criteria: [] },
    rollback: { strategy: 'manual', steps: [] },
    reasoning: {
      proposer: 'agent-1',
      supporters: [],
      dissenters: [],
      consensus_score: 0.9,
    },
    locations: [{ file, start_line, end_line }],
    related: [],
    status: 'proposed',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  } as unknown as Opportunity;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('exportToSarif', () => {
  describe('required SARIF fields', () => {
    it('output has $schema field', () => {
      const sarif = JSON.parse(exportToSarif([]));
      expect(sarif.$schema).toBeTruthy();
      expect(sarif.$schema).toContain('sarif-schema');
    });

    it('output has version "2.1.0"', () => {
      const sarif = JSON.parse(exportToSarif([]));
      expect(sarif.version).toBe('2.1.0');
    });

    it('output has runs array with exactly one run', () => {
      const sarif = JSON.parse(exportToSarif([]));
      expect(Array.isArray(sarif.runs)).toBe(true);
      expect(sarif.runs).toHaveLength(1);
    });

    it('run contains tool.driver with name and version', () => {
      const sarif = JSON.parse(exportToSarif([]));
      const driver = sarif.runs[0].tool.driver;
      expect(driver.name).toBe('Recurrsive');
      expect(driver.version).toBeTruthy();
      expect(driver.informationUri).toBeTruthy();
    });

    it('run contains invocations with executionSuccessful', () => {
      const sarif = JSON.parse(exportToSarif([]));
      const invocations = sarif.runs[0].invocations;
      expect(Array.isArray(invocations)).toBe(true);
      expect(invocations[0].executionSuccessful).toBe(true);
      expect(invocations[0].startTimeUtc).toBeTruthy();
    });

    it('run contains results array', () => {
      const sarif = JSON.parse(exportToSarif([]));
      expect(Array.isArray(sarif.runs[0].results)).toBe(true);
    });
  });

  describe('severity to SARIF level mapping', () => {
    it('maps critical severity to error', () => {
      const opp = makeOpp({ severity: 'critical' });
      const sarif = JSON.parse(exportToSarif([opp]));
      expect(sarif.runs[0].results[0].level).toBe('error');
    });

    it('maps high severity to error', () => {
      const opp = makeOpp({ severity: 'high' });
      const sarif = JSON.parse(exportToSarif([opp]));
      expect(sarif.runs[0].results[0].level).toBe('error');
    });

    it('maps medium severity to warning', () => {
      const opp = makeOpp({ severity: 'medium' });
      const sarif = JSON.parse(exportToSarif([opp]));
      expect(sarif.runs[0].results[0].level).toBe('warning');
    });

    it('maps low severity to note', () => {
      const opp = makeOpp({ severity: 'low' });
      const sarif = JSON.parse(exportToSarif([opp]));
      expect(sarif.runs[0].results[0].level).toBe('note');
    });

    it('maps info severity to note', () => {
      const opp = makeOpp({ severity: 'info' });
      const sarif = JSON.parse(exportToSarif([opp]));
      expect(sarif.runs[0].results[0].level).toBe('note');
    });
  });

  describe('locations', () => {
    it('includes artifact location with file URI', () => {
      const opp = makeOpp({ file: 'src/utils.ts', start_line: 5, end_line: 15 });
      const sarif = JSON.parse(exportToSarif([opp]));
      const loc = sarif.runs[0].results[0].locations[0];

      expect(loc.physicalLocation.artifactLocation.uri).toBe('src/utils.ts');
    });

    it('includes region with start and end lines', () => {
      const opp = makeOpp({ start_line: 5, end_line: 15 });
      const sarif = JSON.parse(exportToSarif([opp]));
      const region = sarif.runs[0].results[0].locations[0].physicalLocation.region;

      expect(region.startLine).toBe(5);
      expect(region.endLine).toBe(15);
    });

    it('handles opportunities with no locations', () => {
      const opp = makeOpp();
      // Override locations to be empty
      (opp as any).locations = [];
      const sarif = JSON.parse(exportToSarif([opp]));
      expect(sarif.runs[0].results[0].locations).toEqual([]);
    });
  });

  describe('results content', () => {
    it('result ruleId follows recurrsive/category/type format', () => {
      const opp = makeOpp({ category: 'security', type: 'risk' });
      const sarif = JSON.parse(exportToSarif([opp]));
      expect(sarif.runs[0].results[0].ruleId).toBe('recurrsive/security/risk');
    });

    it('result message contains title, problem, and recommendation', () => {
      const opp = makeOpp({ title: 'Fix Auth Bug' });
      (opp as any).problem = 'Auth is broken';
      (opp as any).recommendation = 'Fix the auth module';
      const sarif = JSON.parse(exportToSarif([opp]));
      const text = sarif.runs[0].results[0].message.text;

      expect(text).toContain('Fix Auth Bug');
      expect(text).toContain('Auth is broken');
      expect(text).toContain('Fix the auth module');
    });

    it('result properties include opportunity metadata', () => {
      const opp = makeOpp({ severity: 'high', category: 'security' });
      const sarif = JSON.parse(exportToSarif([opp]));
      const props = sarif.runs[0].results[0].properties;

      expect(props.id).toBe(opp.id);
      expect(props.severity).toBe('high');
      expect(props.category).toBe('security');
      expect(props.confidence).toBe(0.8);
      expect(props.compositeScore).toBeDefined();
      expect(typeof props.compositeScore).toBe('number');
    });
  });

  describe('rules', () => {
    it('extracts unique rules from opportunities', () => {
      const opp1 = makeOpp({ category: 'security', type: 'risk', id: '00000000-0000-0000-0000-000000000001' });
      const opp2 = makeOpp({ category: 'security', type: 'risk', id: '00000000-0000-0000-0000-000000000002' });
      const opp3 = makeOpp({ category: 'performance', type: 'opportunity', id: '00000000-0000-0000-0000-000000000003' });

      const sarif = JSON.parse(exportToSarif([opp1, opp2, opp3]));
      const rules = sarif.runs[0].tool.driver.rules;

      // Two unique category/type combos: security/risk, performance/opportunity
      expect(rules).toHaveLength(2);
    });

    it('rule has id, name, and descriptions', () => {
      const opp = makeOpp({ category: 'security', type: 'risk' });
      const sarif = JSON.parse(exportToSarif([opp]));
      const rule = sarif.runs[0].tool.driver.rules[0];

      expect(rule.id).toBe('recurrsive/security/risk');
      expect(rule.name).toBeTruthy();
      expect(rule.shortDescription.text).toBeTruthy();
      expect(rule.fullDescription.text).toBeTruthy();
    });
  });

  describe('empty input', () => {
    it('produces valid SARIF with empty results for no opportunities', () => {
      const sarif = JSON.parse(exportToSarif([]));

      expect(sarif.$schema).toBeTruthy();
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs[0].results).toEqual([]);
      expect(sarif.runs[0].tool.driver.rules).toEqual([]);
    });
  });

  describe('output format', () => {
    it('returns valid JSON string', () => {
      const opp = makeOpp();
      const result = exportToSarif([opp]);
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('is pretty-printed with 2-space indentation', () => {
      const opp = makeOpp();
      const result = exportToSarif([opp]);
      // Pretty printed JSON starts with {\n  "
      expect(result).toMatch(/^\{\n {2}"/);
    });
  });
});
