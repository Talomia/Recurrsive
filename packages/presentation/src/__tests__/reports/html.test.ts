/**
 * Tests for HTML report generation.
 */

import { describe, it, expect } from 'vitest';
import type { Opportunity, MaturityScore } from '@recurrsive/core';
import { generateHtmlReport } from '../../reports/html.js';

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
    problem: 'This is a test problem description.',
    evidence: [{
      id: crypto.randomUUID(),
      type: 'code',
      source: 'test',
      description: 'Evidence',
      entity_ids: [],
      collected_at: '2026-01-01T00:00:00.000Z',
      confidence: 0.9,
    }],
    recommendation: 'Apply the recommended fix.',
    expected_impact: {
      summary: 'Improved performance by 20%',
      metrics: [],
      affected_services: ['api-gateway'],
    },
    confidence,
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

describe('generateHtmlReport', () => {
  describe('valid HTML structure', () => {
    it('contains <!DOCTYPE html>', () => {
      const html = generateHtmlReport([]);
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('contains <html> tag with lang attribute', () => {
      const html = generateHtmlReport([]);
      expect(html).toContain('<html lang="en">');
    });

    it('contains <head> section', () => {
      const html = generateHtmlReport([]);
      expect(html).toContain('<head>');
      expect(html).toContain('</head>');
    });

    it('contains <body> section', () => {
      const html = generateHtmlReport([]);
      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
    });

    it('contains closing </html> tag', () => {
      const html = generateHtmlReport([]);
      expect(html).toContain('</html>');
    });

    it('contains meta charset UTF-8', () => {
      const html = generateHtmlReport([]);
      expect(html).toContain('<meta charset="UTF-8">');
    });

    it('contains meta viewport for responsive design', () => {
      const html = generateHtmlReport([]);
      expect(html).toContain('<meta name="viewport"');
    });
  });

  describe('embedded CSS', () => {
    it('contains <style> tag with CSS', () => {
      const html = generateHtmlReport([]);
      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
    });

    it('CSS contains CSS custom properties (variables)', () => {
      const html = generateHtmlReport([]);
      expect(html).toContain('--bg:');
      expect(html).toContain('--accent:');
    });

    it('CSS contains .card class', () => {
      const html = generateHtmlReport([]);
      expect(html).toContain('.card');
    });

    it('CSS contains responsive media query', () => {
      const html = generateHtmlReport([]);
      expect(html).toContain('@media');
    });
  });

  describe('title', () => {
    it('uses default title in <title> tag', () => {
      const html = generateHtmlReport([]);
      expect(html).toContain('<title>Recurrsive Analysis Report</title>');
    });

    it('uses custom title when provided', () => {
      const html = generateHtmlReport([], { title: 'My Custom Report' });
      expect(html).toContain('<title>My Custom Report</title>');
    });

    it('renders title in the page body', () => {
      const html = generateHtmlReport([], { title: 'Sprint Review' });
      expect(html).toContain('<h1>Sprint Review</h1>');
    });

    it('escapes HTML characters in title', () => {
      const html = generateHtmlReport([], { title: 'Test <script>alert("xss")</script>' });
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('health score SVG', () => {
    it('contains SVG gauge when healthScore is provided', () => {
      const html = generateHtmlReport([], { healthScore: 78 });
      expect(html).toContain('<svg');
      expect(html).toContain('</svg>');
    });

    it('SVG contains the score value', () => {
      const html = generateHtmlReport([], { healthScore: 78 });
      expect(html).toContain('>78<');
    });

    it('SVG contains "/ 100" label', () => {
      const html = generateHtmlReport([], { healthScore: 78 });
      expect(html).toContain('/ 100');
    });

    it('shows Health Score heading', () => {
      const html = generateHtmlReport([], { healthScore: 78 });
      expect(html).toContain('<h2>Health Score</h2>');
    });

    it('shows health status label "Excellent" for score >= 90', () => {
      const html = generateHtmlReport([], { healthScore: 92 });
      expect(html).toContain('Excellent');
    });

    it('shows health status label "Good" for score >= 75', () => {
      const html = generateHtmlReport([], { healthScore: 80 });
      expect(html).toContain('Good');
    });

    it('shows health status label "Fair" for score >= 60', () => {
      const html = generateHtmlReport([], { healthScore: 65 });
      expect(html).toContain('Fair');
    });

    it('shows health status label "Needs Attention" for score >= 40 (same 5-tier scale as markdown/terminal)', () => {
      const html = generateHtmlReport([], { healthScore: 55 });
      expect(html).toContain('Needs Attention');
    });

    it('shows health status label "Critical" for score < 40', () => {
      const html = generateHtmlReport([], { healthScore: 30 });
      expect(html).toContain('Critical');
    });

    it('does not contain health section when healthScore not provided', () => {
      const html = generateHtmlReport([]);
      expect(html).not.toContain('Health Score');
    });
  });

  describe('opportunity cards', () => {
    it('renders opportunity title', () => {
      const opp = makeOpp({ title: 'Fix Memory Leak' });
      const html = generateHtmlReport([opp]);
      expect(html).toContain('Fix Memory Leak');
    });

    it('renders severity badge with correct class', () => {
      const opp = makeOpp({ severity: 'critical' });
      const html = generateHtmlReport([opp]);
      expect(html).toContain('badge-critical');
    });

    it('renders problem description', () => {
      const opp = makeOpp();
      const html = generateHtmlReport([opp]);
      expect(html).toContain('test problem');
    });

    it('renders recommendation', () => {
      const opp = makeOpp();
      const html = generateHtmlReport([opp]);
      expect(html).toContain('Recommendation:');
    });

    it('renders meta info (category, confidence, effort)', () => {
      const opp = makeOpp({ category: 'security', confidence: 0.85 });
      const html = generateHtmlReport([opp]);
      expect(html).toContain('security');
      expect(html).toContain('85% confidence');
    });

    it('respects maxCards limit', () => {
      const opps = Array.from({ length: 30 }, (_, i) =>
        makeOpp({ title: `Opp ${i}` }),
      );
      const html = generateHtmlReport(opps, { maxCards: 5 });

      // Count card-header occurrences
      const cardCount = (html.match(/class="card-header"/g) ?? []).length;
      expect(cardCount).toBe(5);
    });
  });

  describe('stats grid', () => {
    it('shows total findings count', () => {
      const opps = [makeOpp(), makeOpp(), makeOpp()];
      const html = generateHtmlReport(opps);
      expect(html).toContain('>3<');
      expect(html).toContain('Total Opportunities');
    });

    it('shows severity counts with colors', () => {
      const opps = [
        makeOpp({ severity: 'critical' }),
        makeOpp({ severity: 'high' }),
      ];
      const html = generateHtmlReport(opps);
      expect(html).toContain('critical');
      expect(html).toContain('high');
    });
  });

  describe('category breakdown chart', () => {
    it('renders category breakdown with SVG bar chart', () => {
      const opps = [
        makeOpp({ category: 'security' }),
        makeOpp({ category: 'performance' }),
      ];
      const html = generateHtmlReport(opps);
      expect(html).toContain('<h2>Category Breakdown</h2>');
      expect(html).toContain('<svg');
    });

    it('does not render category breakdown for empty opportunities', () => {
      const html = generateHtmlReport([]);
      expect(html).not.toContain('Category Breakdown');
    });
  });

  describe('maturity scores', () => {
    it('renders maturity assessment table when provided', () => {
      const maturity: MaturityScore[] = [{
        dimension: 'security',
        level: 'defined',
        score: 72,
        trend: 'improving',
        evidence: [],
        recommendations: [],
      }];
      const html = generateHtmlReport([], { maturityScores: maturity });

      expect(html).toContain('Maturity Assessment');
      expect(html).toContain('security');
      expect(html).toContain('defined');
      expect(html).toContain('72/100');
    });

    it('shows trend icons', () => {
      const maturity: MaturityScore[] = [{
        dimension: 'testing',
        level: 'initial',
        score: 30,
        trend: 'declining',
        evidence: [],
        recommendations: [],
      }];
      const html = generateHtmlReport([], { maturityScores: maturity });
      expect(html).toContain('📉');
    });
  });

  describe('handles empty opportunities', () => {
    it('produces valid HTML with no opportunities', () => {
      const html = generateHtmlReport([]);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
      expect(html).toContain('Total Opportunities');
    });

    it('does not render Opportunities heading for empty input', () => {
      const html = generateHtmlReport([]);
      expect(html).not.toContain('<h2>Opportunities</h2>');
    });
  });

  describe('footer', () => {
    it('contains Recurrsive version in footer', () => {
      const html = generateHtmlReport([]);
      expect(html).toContain('Recurrsive v0.1.0');
    });
  });
});
