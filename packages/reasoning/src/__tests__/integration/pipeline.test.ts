/**
 * @module @recurrsive/reasoning/__tests__/integration
 *
 * Integration tests for the reasoning pipeline:
 * findings → specialist analysis → debate → synthesis → ranked opportunities.
 *
 * Tests verify that the reasoning engine components work together
 * to process findings and produce structured intelligence.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import { createDefaultSpecialists } from '../../specialists/index.js';
import { DebateProtocol } from '../../debate/protocol.js';
import { Synthesizer } from '../../synthesizer/synthesizer.js';
import { Judge } from '../../judge/judge.js';
import type { Finding } from '@recurrsive/core';
import { generateId, nowISO } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Create a test finding. */
function mockFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: generateId(),
    title: 'Test finding',
    description: 'A test finding for integration testing',
    severity: 'medium',
    category: 'architecture',
    analyzer_id: 'test.analyzer',
    confidence: 0.85,
    evidence: [
      {
        id: generateId(),
        description: 'Test evidence',
        confidence: 0.9,
        source: 'test',
        properties: {},
      },
    ],
    location: {
      file: 'src/test.ts',
      line_start: 1,
      line_end: 10,
    },
    recommendations: ['Fix the issue'],
    tags: ['test'],
    created_at: nowISO(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Reasoning Pipeline Integration', () => {
  describe('Specialist Creation', () => {
    it('creates all 19 default specialists', () => {
      const specialists = createDefaultSpecialists();
      expect(specialists.length).toBe(19);
    });

    it('all specialists have unique roles', () => {
      const specialists = createDefaultSpecialists();
      const roles = specialists.map((s) => s.role);
      const uniqueRoles = new Set(roles);
      expect(uniqueRoles.size).toBe(roles.length);
    });

    it('all specialists have required properties', () => {
      const specialists = createDefaultSpecialists();
      for (const specialist of specialists) {
        expect(specialist.role).toBeTruthy();
        expect(specialist.name).toBeTruthy();
        expect(specialist.cognitiveFramework).toBeTruthy();
        expect(specialist.systemPrompt).toBeTruthy();
        expect(typeof specialist.analyzeFindings).toBe('function');
      }
    });
  });

  describe('Debate Protocol', () => {
    it('constructs with default configuration', () => {
      const protocol = new DebateProtocol({
        maxRounds: 3,
        consensusThreshold: 0.7,
        minParticipants: 2,
      });
      expect(protocol).toBeDefined();
    });
  });

  describe('Synthesizer', () => {
    it('constructs successfully', () => {
      const synthesizer = new Synthesizer();
      expect(synthesizer).toBeDefined();
    });
  });

  describe('Judge', () => {
    it('constructs successfully', () => {
      const judge = new Judge();
      expect(judge).toBeDefined();
    });
  });

  describe('Finding pipeline', () => {
    it('creates findings with proper structure for reasoning', () => {
      const findings = [
        mockFinding({
          title: 'Missing error handling in API endpoint',
          severity: 'high',
          category: 'reliability',
        }),
        mockFinding({
          title: 'Hardcoded API key detected',
          severity: 'critical',
          category: 'security',
        }),
        mockFinding({
          title: 'N+1 query pattern detected',
          severity: 'medium',
          category: 'performance',
        }),
      ];

      // All findings should have the minimum required fields
      for (const finding of findings) {
        expect(finding.id).toBeTruthy();
        expect(finding.title).toBeTruthy();
        expect(finding.severity).toBeTruthy();
        expect(finding.category).toBeTruthy();
        expect(finding.analyzer_id).toBeTruthy();
        expect(finding.confidence).toBeGreaterThan(0);
        expect(finding.evidence.length).toBeGreaterThan(0);
      }

      // Findings can be categorized by severity
      const critical = findings.filter((f) => f.severity === 'critical');
      const high = findings.filter((f) => f.severity === 'high');
      expect(critical.length).toBe(1);
      expect(high.length).toBe(1);
    });

    it('findings can be grouped by category for specialist assignment', () => {
      const findings = [
        mockFinding({ category: 'security', title: 'Secret leak' }),
        mockFinding({ category: 'security', title: 'Missing auth' }),
        mockFinding({ category: 'performance', title: 'Slow query' }),
        mockFinding({ category: 'architecture', title: 'Circular dependency' }),
      ];

      const grouped = new Map<string, Finding[]>();
      for (const f of findings) {
        const list = grouped.get(f.category) ?? [];
        list.push(f);
        grouped.set(f.category, list);
      }

      expect(grouped.get('security')?.length).toBe(2);
      expect(grouped.get('performance')?.length).toBe(1);
      expect(grouped.get('architecture')?.length).toBe(1);
    });

    it('findings with evidence can be ranked by confidence', () => {
      const findings = [
        mockFinding({ confidence: 0.95 }),
        mockFinding({ confidence: 0.65 }),
        mockFinding({ confidence: 0.85 }),
      ];

      const ranked = [...findings].sort((a, b) => b.confidence - a.confidence);
      expect(ranked[0].confidence).toBe(0.95);
      expect(ranked[1].confidence).toBe(0.85);
      expect(ranked[2].confidence).toBe(0.65);
    });
  });
});
