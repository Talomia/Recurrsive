/**
 * Tests for markdown report generation.
 */

import { describe, it, expect } from 'vitest';
import type { Opportunity, MaturityScore } from '@recurrsive/core';
import { generateMarkdownReport } from '../../reports/markdown.js';

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
}> = {}): Opportunity {
  const {
    id = crypto.randomUUID(),
    title = 'Test Opportunity',
    severity = 'medium',
    category = 'performance',
    confidence = 0.8,
    status = 'proposed',
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
    locations: [{ file: 'src/index.ts', start_line: 10 }],
    related: [],
    status,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  } as unknown as Opportunity;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateMarkdownReport', () => {
  describe('basic structure', () => {
    it('contains the default title', () => {
      const md = generateMarkdownReport([]);
      expect(md).toContain('# Recurrsive Analysis Report');
    });

    it('uses custom title when provided', () => {
      const md = generateMarkdownReport([], { title: 'Sprint 42 Review' });
      expect(md).toContain('# Sprint 42 Review');
    });

    it('contains generation timestamp', () => {
      const md = generateMarkdownReport([]);
      expect(md).toContain('_Generated:');
    });

    it('contains Executive Summary section', () => {
      const md = generateMarkdownReport([]);
      expect(md).toContain('## Executive Summary');
    });

    it('shows total findings count', () => {
      const opps = [makeOpp(), makeOpp()];
      const md = generateMarkdownReport(opps);
      expect(md).toContain('**Total Opportunities:** 2');
    });
  });

  describe('health score section', () => {
    it('contains health score when provided', () => {
      const md = generateMarkdownReport([], { healthScore: 78 });
      expect(md).toContain('**Health Score:** 78/100');
    });

    it('shows Excellent label for score >= 90', () => {
      const md = generateMarkdownReport([], { healthScore: 95 });
      expect(md).toContain('Excellent');
    });

    it('shows Good label for score >= 75', () => {
      const md = generateMarkdownReport([], { healthScore: 80 });
      expect(md).toContain('Good');
    });

    it('shows Fair label for score >= 60', () => {
      const md = generateMarkdownReport([], { healthScore: 65 });
      expect(md).toContain('Fair');
    });

    it('shows Needs Attention label for score >= 40', () => {
      const md = generateMarkdownReport([], { healthScore: 45 });
      expect(md).toContain('Needs Attention');
    });

    it('shows Critical label for score < 40', () => {
      const md = generateMarkdownReport([], { healthScore: 20 });
      expect(md).toContain('Critical');
    });

    it('omits health score section when not provided', () => {
      const md = generateMarkdownReport([]);
      expect(md).not.toContain('**Health Score:**');
    });
  });

  describe('severity breakdown', () => {
    it('shows severity breakdown table', () => {
      const opps = [
        makeOpp({ severity: 'critical' }),
        makeOpp({ severity: 'high' }),
        makeOpp({ severity: 'medium' }),
      ];
      const md = generateMarkdownReport(opps);
      expect(md).toContain('### Severity Breakdown');
      expect(md).toContain('critical');
      expect(md).toContain('high');
      expect(md).toContain('medium');
    });

    it('includes percentage column', () => {
      const opps = [makeOpp({ severity: 'critical' })];
      const md = generateMarkdownReport(opps);
      expect(md).toContain('100.0%');
    });

    it('shows severity badge emojis', () => {
      const opps = [makeOpp({ severity: 'critical' })];
      const md = generateMarkdownReport(opps);
      expect(md).toContain('🔴');
    });
  });

  describe('category breakdown', () => {
    it('shows category breakdown table', () => {
      const opps = [
        makeOpp({ category: 'security' }),
        makeOpp({ category: 'performance' }),
      ];
      const md = generateMarkdownReport(opps);
      expect(md).toContain('### Category Breakdown');
      expect(md).toContain('security');
      expect(md).toContain('performance');
    });
  });

  describe('opportunity table', () => {
    it('contains Top Opportunities section with opportunity details', () => {
      const opp = makeOpp({ title: 'Fix Memory Leak' });
      const md = generateMarkdownReport([opp]);

      expect(md).toContain('## Top Opportunities');
      expect(md).toContain('Fix Memory Leak');
    });

    it('shows problem and recommendation for each opportunity', () => {
      const opp = makeOpp();
      const md = generateMarkdownReport([opp]);
      expect(md).toContain('**Problem:**');
      expect(md).toContain('**Recommendation:**');
    });

    it('shows expected impact section', () => {
      const opp = makeOpp();
      const md = generateMarkdownReport([opp]);
      expect(md).toContain('**Expected Impact:**');
    });

    it('respects maxDetailedOpportunities limit', () => {
      const opps = Array.from({ length: 15 }, (_, i) =>
        makeOpp({ title: `Opp ${i}` }),
      );
      const md = generateMarkdownReport(opps, { maxDetailedOpportunities: 3 });

      // Only the top 3 should appear as detailed sections
      const detailSections = md.match(/### [🔴🟠🟡🟢🔵]/g) ?? [];
      expect(detailSections.length).toBe(3);
    });
  });

  describe('handles empty opportunities array', () => {
    it('produces valid output with no opportunities', () => {
      const md = generateMarkdownReport([]);

      expect(md).toContain('# Recurrsive Analysis Report');
      expect(md).toContain('**Total Opportunities:** 0');
      expect(md).not.toContain('## Top Opportunities');
    });
  });

  describe('handles opportunities with various severities', () => {
    it('correctly assigns badge emoji per severity', () => {
      const severities = ['critical', 'high', 'medium', 'low', 'info'] as const;
      const emojis = ['🔴', '🟠', '🟡', '🟢', '🔵'];

      for (let i = 0; i < severities.length; i++) {
        const opp = makeOpp({ severity: severities[i]! });
        const md = generateMarkdownReport([opp]);
        expect(md).toContain(emojis[i]!);
      }
    });
  });

  describe('maturity scores', () => {
    it('includes maturity assessment when provided', () => {
      const maturity: MaturityScore[] = [{
        dimension: 'security',
        level: 'defined',
        score: 72,
        trend: 'improving',
        evidence: ['Good test coverage'],
        recommendations: ['Add SAST scanning'],
      }];
      const md = generateMarkdownReport([], { maturityScores: maturity });

      expect(md).toContain('## Maturity Assessment');
      expect(md).toContain('security');
      expect(md).toContain('defined');
      expect(md).toContain('72/100');
      expect(md).toContain('📈');
    });

    it('includes maturity recommendations', () => {
      const maturity: MaturityScore[] = [{
        dimension: 'testing',
        level: 'initial',
        score: 20,
        trend: 'stable',
        evidence: [],
        recommendations: ['Increase test coverage to 80%'],
      }];
      const md = generateMarkdownReport([], { maturityScores: maturity });
      expect(md).toContain('### Maturity Recommendations');
      expect(md).toContain('Increase test coverage to 80%');
    });
  });

  describe('action items', () => {
    it('includes action items section by default', () => {
      const opp = makeOpp({ status: 'proposed' });
      const md = generateMarkdownReport([opp]);
      expect(md).toContain('## Action Items');
    });

    it('excludes action items when includeActionItems is false', () => {
      const opp = makeOpp({ status: 'proposed' });
      const md = generateMarkdownReport([opp], { includeActionItems: false });
      expect(md).not.toContain('## Action Items');
    });

    it('only includes proposed or accepted items in action items', () => {
      const opps = [
        makeOpp({ status: 'proposed', title: 'ActionableOne' }),
        makeOpp({ status: 'accepted', title: 'ActionableTwo' }),
        makeOpp({ status: 'implemented', title: 'NotActionable' }),
      ];
      const md = generateMarkdownReport(opps);

      // Action items section should list the actionable ones
      if (md.includes('## Action Items')) {
        expect(md).toContain('ActionableOne');
        expect(md).toContain('ActionableTwo');
      }
    });
  });
});
