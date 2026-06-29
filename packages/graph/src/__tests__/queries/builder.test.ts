/**
 * @module __tests__/queries/builder
 *
 * Tests for graph query builder functions in both SQL and Cypher dialects.
 */

import { describe, it, expect } from 'vitest';
import {
  findCallChain,
  findDependencyTree,
  findCircularDeps,
  findDeadCode,
  findEntitiesByPattern,
  findAIWorkflow,
  findAllPromptsForAgent,
  findModelUsage,
} from '../../queries/builders.js';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Query Builders', () => {
  const testId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  // ── findDependencyTree ────────────────────────────────────────────────

  describe('findDependencyTree', () => {
    it('generates SQL query for SQLite dialect', () => {
      const query = findDependencyTree(testId, 'sql');
      expect(query).toContain('WITH RECURSIVE dep_tree');
      expect(query).toContain(testId);
      expect(query).toContain("'depends_on', 'imports', 'references'");
      expect(query).toContain('JOIN entities e ON e.id = dt.entity_id');
    });

    it('generates Cypher query for cypher dialect', () => {
      const query = findDependencyTree(testId, 'cypher');
      expect(query).toContain("cypher('recurrsive'");
      expect(query).toContain('depends_on|imports|references');
      expect(query).toContain(testId);
    });

    it('defaults to cypher dialect', () => {
      const query = findDependencyTree(testId);
      expect(query).toContain("cypher('recurrsive'");
    });

    it('produces valid SQL that references expected tables', () => {
      const query = findDependencyTree(testId, 'sql');
      expect(query).toContain('relationships');
      expect(query).toContain('entities');
      expect(query).toContain('ORDER BY dt.depth');
    });
  });

  // ── findCircularDeps ──────────────────────────────────────────────────

  describe('findCircularDeps', () => {
    it('generates SQL query that detects cycles', () => {
      const query = findCircularDeps(testId, 'sql');
      expect(query).toContain('WITH RECURSIVE dep_walk');
      expect(query).toContain('is_cycle');
      expect(query).toContain("'depends_on', 'imports'");
      expect(query).toContain('WHERE dw.is_cycle = 1');
    });

    it('generates Cypher query for cycles', () => {
      const query = findCircularDeps(testId, 'cypher');
      expect(query).toContain("cypher('recurrsive'");
      expect(query).toContain('depends_on|imports');
      expect(query).toContain(testId);
    });

    it('limits recursive depth to 10 in SQL', () => {
      const query = findCircularDeps(testId, 'sql');
      expect(query).toContain('dw.depth < 10');
    });
  });

  // ── findDeadCode ──────────────────────────────────────────────────────

  describe('findDeadCode', () => {
    it('generates SQL query finding unreferenced functions', () => {
      const query = findDeadCode(testId, 'sql');
      expect(query).toContain('repo_functions');
      expect(query).toContain("type = 'function'");
      expect(query).toContain("r.type = 'calls'");
      expect(query).toContain('NOT EXISTS');
      expect(query).toContain(testId);
    });

    it('generates Cypher query for dead code', () => {
      const query = findDeadCode(testId, 'cypher');
      expect(query).toContain("cypher('recurrsive'");
      expect(query).toContain('NOT EXISTS');
      expect(query).toContain(':function');
      expect(query).toContain(':calls');
    });

    it('uses recursive CTE for ancestry traversal in SQL', () => {
      const query = findDeadCode(testId, 'sql');
      expect(query).toContain('WITH RECURSIVE ancestry');
      expect(query).toContain("type = 'contains'");
    });
  });

  // ── findEntitiesByPattern ─────────────────────────────────────────────

  describe('findEntitiesByPattern', () => {
    it('generates SQL query with LIKE pattern matching', () => {
      const query = findEntitiesByPattern('handleRequest', undefined, 'sql');
      expect(query).toContain("LIKE '%handleRequest%'");
      expect(query).toContain('e.name');
      expect(query).toContain('e.qualified_name');
      expect(query).toContain('ORDER BY e.name');
    });

    it('generates Cypher query with regex matching', () => {
      const query = findEntitiesByPattern('handleRequest', undefined, 'cypher');
      expect(query).toContain("cypher('recurrsive'");
      expect(query).toContain('handleRequest');
      expect(query).toContain('=~');
    });

    it('includes entity type filter when provided', () => {
      const query = findEntitiesByPattern('handler', 'function', 'sql');
      expect(query).toContain("e.type = 'function'");
    });

    it('omits entity type filter when not provided', () => {
      const query = findEntitiesByPattern('handler', undefined, 'sql');
      expect(query).not.toContain('e.type =');
    });

    it('escapes single quotes in patterns', () => {
      const query = findEntitiesByPattern("it's", undefined, 'sql');
      expect(query).toContain("it''s");
    });

    it('applies entity type filter in Cypher dialect', () => {
      const query = findEntitiesByPattern('handler', 'function', 'cypher');
      expect(query).toContain(':function');
    });
  });

  // ── findCallChain ─────────────────────────────────────────────────────

  describe('findCallChain', () => {
    it('generates SQL recursive CTE for call chain', () => {
      const query = findCallChain(testId, 5, 'sql');
      expect(query).toContain('WITH RECURSIVE call_chain');
      expect(query).toContain(testId);
      expect(query).toContain("r.type = 'calls'");
      expect(query).toContain('cc.depth < 5');
    });

    it('generates Cypher query for call chain', () => {
      const query = findCallChain(testId, 3, 'cypher');
      expect(query).toContain("cypher('recurrsive'");
      expect(query).toContain(':calls*1..3');
    });

    it('uses default maxDepth of 5', () => {
      const query = findCallChain(testId, undefined, 'sql');
      expect(query).toContain('cc.depth < 5');
    });
  });

  // ── findAIWorkflow ────────────────────────────────────────────────────

  describe('findAIWorkflow', () => {
    it('generates SQL query joining agent relationships', () => {
      const query = findAIWorkflow(testId, 'sql');
      expect(query).toContain(testId);
      expect(query).toContain("'uses_model'");
      expect(query).toContain("'uses_tool'");
      expect(query).toContain("'has_prompt'");
      expect(query).toContain("'invokes_agent'");
    });

    it('generates Cypher query for AI workflow', () => {
      const query = findAIWorkflow(testId, 'cypher');
      expect(query).toContain("cypher('recurrsive'");
      expect(query).toContain('uses_model|uses_tool|has_prompt|invokes_agent');
    });
  });

  // ── findAllPromptsForAgent ────────────────────────────────────────────

  describe('findAllPromptsForAgent', () => {
    it('generates SQL query for agent prompts', () => {
      const query = findAllPromptsForAgent(testId, 'sql');
      expect(query).toContain(testId);
      expect(query).toContain("r.type = 'has_prompt'");
      expect(query).toContain("p.type = 'prompt'");
      expect(query).toContain('ORDER BY p.name');
    });

    it('generates Cypher query for agent prompts', () => {
      const query = findAllPromptsForAgent(testId, 'cypher');
      expect(query).toContain(':agent');
      expect(query).toContain(':has_prompt');
      expect(query).toContain(':prompt');
    });
  });

  // ── findModelUsage ────────────────────────────────────────────────────

  describe('findModelUsage', () => {
    it('generates SQL query for model usage', () => {
      const query = findModelUsage('sql');
      expect(query).toContain("r.type = 'uses_model'");
      expect(query).toContain("m.type = 'model'");
      expect(query).toContain('ORDER BY m.name, c.name');
    });

    it('generates Cypher query for model usage', () => {
      const query = findModelUsage('cypher');
      expect(query).toContain(':uses_model');
      expect(query).toContain(':model');
    });
  });
});
