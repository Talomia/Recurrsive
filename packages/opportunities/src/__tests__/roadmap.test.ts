/**
 * Tests for roadmap generation.
 */

import { describe, it, expect } from 'vitest';
import type { Opportunity } from '@recurrsive/core';
import { generateRoadmap, renderRoadmapMarkdown } from '../roadmap.js';
import type { Roadmap, PhaseName } from '../roadmap.js';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeOpp(overrides: Partial<{
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: number;
  t_shirt: 'xs' | 's' | 'm' | 'l' | 'xl';
  category: string;
  estimated_hours?: number;
}> = {}): Opportunity {
  const {
    id = crypto.randomUUID(),
    title = 'Test Opportunity',
    severity = 'medium',
    confidence = 0.8,
    t_shirt = 'm',
    category = 'performance',
    estimated_hours,
  } = overrides;

  return {
    id,
    title,
    type: 'opportunity',
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
      metrics: [{ name: 'latency', change_percent: -10 }],
      affected_services: ['svc-a'],
    },
    confidence,
    effort: {
      t_shirt,
      estimated_hours,
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
    locations: [],
    related: [],
    status: 'proposed',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  } as unknown as Opportunity;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateRoadmap', () => {
  describe('phase classification', () => {
    it('classifies xs effort + high confidence as Quick Wins', () => {
      const opp = makeOpp({ t_shirt: 'xs', confidence: 0.8 });
      const roadmap = generateRoadmap([opp]);

      const quickWins = roadmap.phases.find((p) => p.name === 'Quick Wins')!;
      expect(quickWins.entries).toHaveLength(1);
      expect(quickWins.entries[0]!.opportunity.id).toBe(opp.id);
    });

    it('classifies s effort + high confidence as Quick Wins', () => {
      const opp = makeOpp({ t_shirt: 's', confidence: 0.7 });
      const roadmap = generateRoadmap([opp]);

      const quickWins = roadmap.phases.find((p) => p.name === 'Quick Wins')!;
      expect(quickWins.entries).toHaveLength(1);
    });

    it('classifies xs effort + low confidence (< 0.5) as Strategic Improvements', () => {
      const opp = makeOpp({ t_shirt: 'xs', confidence: 0.3 });
      const roadmap = generateRoadmap([opp]);

      const strategic = roadmap.phases.find((p) => p.name === 'Strategic Improvements')!;
      expect(strategic.entries).toHaveLength(1);
    });

    it('classifies m effort as Strategic Improvements', () => {
      const opp = makeOpp({ t_shirt: 'm', confidence: 0.9 });
      const roadmap = generateRoadmap([opp]);

      const strategic = roadmap.phases.find((p) => p.name === 'Strategic Improvements')!;
      expect(strategic.entries).toHaveLength(1);
    });

    it('classifies l effort as Long-term Investments', () => {
      const opp = makeOpp({ t_shirt: 'l' });
      const roadmap = generateRoadmap([opp]);

      const longTerm = roadmap.phases.find((p) => p.name === 'Long-term Investments')!;
      expect(longTerm.entries).toHaveLength(1);
    });

    it('classifies xl effort as Long-term Investments', () => {
      const opp = makeOpp({ t_shirt: 'xl' });
      const roadmap = generateRoadmap([opp]);

      const longTerm = roadmap.phases.find((p) => p.name === 'Long-term Investments')!;
      expect(longTerm.entries).toHaveLength(1);
    });
  });

  describe('all opportunities assigned to a phase', () => {
    it('every opportunity appears in exactly one phase', () => {
      const opps = [
        makeOpp({ t_shirt: 'xs', confidence: 0.9 }),
        makeOpp({ t_shirt: 'm', confidence: 0.6 }),
        makeOpp({ t_shirt: 'xl', confidence: 0.5 }),
        makeOpp({ t_shirt: 's', confidence: 0.3 }),
        makeOpp({ t_shirt: 'l', confidence: 0.8 }),
      ];
      const roadmap = generateRoadmap(opps);

      const totalAssigned = roadmap.phases.reduce((sum, p) => sum + p.count, 0);
      expect(totalAssigned).toBe(opps.length);
    });
  });

  describe('roadmap structure', () => {
    it('always has exactly 3 phases in order', () => {
      const roadmap = generateRoadmap([]);
      expect(roadmap.phases).toHaveLength(3);
      expect(roadmap.phases[0]!.name).toBe('Quick Wins');
      expect(roadmap.phases[1]!.name).toBe('Strategic Improvements');
      expect(roadmap.phases[2]!.name).toBe('Long-term Investments');
    });

    it('each phase has a description', () => {
      const roadmap = generateRoadmap([]);
      for (const phase of roadmap.phases) {
        expect(phase.description).toBeTruthy();
        expect(typeof phase.description).toBe('string');
      }
    });

    it('has generatedAt timestamp', () => {
      const roadmap = generateRoadmap([]);
      expect(roadmap.generatedAt).toBeTruthy();
      // ISO-8601 format
      expect(() => new Date(roadmap.generatedAt)).not.toThrow();
    });

    it('totalOpportunities matches input length', () => {
      const opps = [makeOpp(), makeOpp(), makeOpp()];
      const roadmap = generateRoadmap(opps);
      expect(roadmap.totalOpportunities).toBe(3);
    });
  });

  describe('phase entry details', () => {
    it('entries have score and estimatedHours', () => {
      const opp = makeOpp({ t_shirt: 'xs', confidence: 0.9, estimated_hours: 4 });
      const roadmap = generateRoadmap([opp]);

      const quickWins = roadmap.phases.find((p) => p.name === 'Quick Wins')!;
      const entry = quickWins.entries[0]!;
      expect(entry.score).toBeGreaterThan(0);
      expect(entry.estimatedHours).toBe(4);
    });

    it('estimatedHours is undefined when not provided', () => {
      const opp = makeOpp({ t_shirt: 'xs', confidence: 0.9 });
      const roadmap = generateRoadmap([opp]);

      const quickWins = roadmap.phases.find((p) => p.name === 'Quick Wins')!;
      expect(quickWins.entries[0]!.estimatedHours).toBeUndefined();
    });
  });

  describe('phase totals', () => {
    it('totalEstimatedHours aggregates entry hours', () => {
      const opp1 = makeOpp({ t_shirt: 'xs', confidence: 0.9, estimated_hours: 4 });
      const opp2 = makeOpp({ t_shirt: 's', confidence: 0.8, estimated_hours: 8 });
      const roadmap = generateRoadmap([opp1, opp2]);

      const quickWins = roadmap.phases.find((p) => p.name === 'Quick Wins')!;
      expect(quickWins.totalEstimatedHours).toBe(12);
    });

    it('totalEstimatedHours treats missing hours as 0', () => {
      const opp = makeOpp({ t_shirt: 'xs', confidence: 0.9 });
      const roadmap = generateRoadmap([opp]);

      const quickWins = roadmap.phases.find((p) => p.name === 'Quick Wins')!;
      expect(quickWins.totalEstimatedHours).toBe(0);
    });

    it('totalEstimatedImpact is computed', () => {
      const opp = makeOpp({ t_shirt: 'xs', confidence: 0.9, severity: 'critical' });
      const roadmap = generateRoadmap([opp]);

      const quickWins = roadmap.phases.find((p) => p.name === 'Quick Wins')!;
      expect(quickWins.totalEstimatedImpact).toBeGreaterThan(0);
    });

    it('count reflects number of entries', () => {
      const opp1 = makeOpp({ t_shirt: 'xs', confidence: 0.9 });
      const opp2 = makeOpp({ t_shirt: 'xs', confidence: 0.8 });
      const roadmap = generateRoadmap([opp1, opp2]);

      const quickWins = roadmap.phases.find((p) => p.name === 'Quick Wins')!;
      expect(quickWins.count).toBe(2);
    });
  });

  describe('summary statistics', () => {
    it('summary.totalEstimatedHours sums across phases', () => {
      const opps = [
        makeOpp({ t_shirt: 'xs', confidence: 0.9, estimated_hours: 4 }),
        makeOpp({ t_shirt: 'l', estimated_hours: 40 }),
      ];
      const roadmap = generateRoadmap(opps);

      expect(roadmap.summary.totalEstimatedHours).toBe(44);
    });

    it('summary.totalEstimatedImpact sums across phases', () => {
      const opps = [makeOpp({ severity: 'critical' }), makeOpp({ severity: 'low' })];
      const roadmap = generateRoadmap(opps);

      expect(roadmap.summary.totalEstimatedImpact).toBeGreaterThan(0);
    });

    it('severityBreakdown counts correctly', () => {
      const opps = [
        makeOpp({ severity: 'critical' }),
        makeOpp({ severity: 'critical' }),
        makeOpp({ severity: 'low' }),
      ];
      const roadmap = generateRoadmap(opps);

      expect(roadmap.summary.severityBreakdown.critical).toBe(2);
      expect(roadmap.summary.severityBreakdown.low).toBe(1);
      expect(roadmap.summary.severityBreakdown.medium).toBe(0);
    });

    it('categoryBreakdown counts correctly', () => {
      const opps = [
        makeOpp({ category: 'security' }),
        makeOpp({ category: 'security' }),
        makeOpp({ category: 'performance' }),
      ];
      const roadmap = generateRoadmap(opps);

      expect(roadmap.summary.categoryBreakdown['security']).toBe(2);
      expect(roadmap.summary.categoryBreakdown['performance']).toBe(1);
    });
  });

  describe('empty input', () => {
    it('produces a valid roadmap with empty phases', () => {
      const roadmap = generateRoadmap([]);

      expect(roadmap.totalOpportunities).toBe(0);
      expect(roadmap.phases).toHaveLength(3);
      for (const phase of roadmap.phases) {
        expect(phase.entries).toEqual([]);
        expect(phase.count).toBe(0);
        expect(phase.totalEstimatedHours).toBe(0);
      }
    });
  });
});

describe('renderRoadmapMarkdown', () => {
  it('renders a valid markdown string', () => {
    const roadmap = generateRoadmap([
      makeOpp({ t_shirt: 'xs', confidence: 0.9, severity: 'critical', title: 'Quick Fix' }),
      makeOpp({ t_shirt: 'xl', severity: 'low', title: 'Big Refactor' }),
    ]);
    const md = renderRoadmapMarkdown(roadmap);

    expect(md).toContain('# Implementation Roadmap');
    expect(md).toContain('## Quick Wins');
    expect(md).toContain('## Strategic Improvements');
    expect(md).toContain('## Long-term Investments');
    expect(md).toContain('Quick Fix');
    expect(md).toContain('Big Refactor');
  });

  it('includes summary section', () => {
    const roadmap = generateRoadmap([makeOpp()]);
    const md = renderRoadmapMarkdown(roadmap);

    expect(md).toContain('## Summary');
    expect(md).toContain('### Severity Breakdown');
    expect(md).toContain('### Category Breakdown');
  });

  it('shows "No opportunities" message for empty phases', () => {
    const roadmap = generateRoadmap([]);
    const md = renderRoadmapMarkdown(roadmap);

    expect(md).toContain('No opportunities in this phase');
  });
});
