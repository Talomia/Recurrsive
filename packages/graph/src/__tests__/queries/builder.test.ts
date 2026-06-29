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
      const { sql, params } = findDependencyTree(testId, 'sql');
      expect(sql).toContain('WITH RECURSIVE dep_tree');
      expect(sql).not.toContain(testId);
      expect(params).toContain(testId);
      expect(sql).toContain("'depends_on', 'imports', 'references'");
      expect(sql).toContain('JOIN entities e ON e.id = dt.entity_id');
    });

    it('generates Cypher query for cypher dialect', () => {
      const { sql, params } = findDependencyTree(testId, 'cypher');
      expect(sql).toContain("cypher('recurrsive'");
      expect(sql).toContain('depends_on|imports|references');
      expect(sql).not.toContain(testId);
      expect(params).toContain(testId);
    });

    it('defaults to cypher dialect', () => {
      const { sql } = findDependencyTree(testId);
      expect(sql).toContain("cypher('recurrsive'");
    });

    it('produces valid SQL that references expected tables', () => {
      const { sql } = findDependencyTree(testId, 'sql');
      expect(sql).toContain('relationships');
      expect(sql).toContain('entities');
      expect(sql).toContain('ORDER BY dt.depth');
    });
  });

  // ── findCircularDeps ──────────────────────────────────────────────────

  describe('findCircularDeps', () => {
    it('generates SQL query that detects cycles scoped to repo', () => {
      const { sql, params } = findCircularDeps(testId, 'sql');
      expect(sql).toContain('WITH RECURSIVE ancestry');
      expect(sql).toContain('dep_walk');
      expect(sql).toContain('is_cycle');
      expect(sql).toContain("'depends_on', 'imports'");
      expect(sql).toContain('WHERE dw.is_cycle = 1');
      expect(sql).toContain('IN (SELECT eid FROM ancestry)');
      expect(params).toContain(testId);
    });

    it('generates Cypher query for cycles', () => {
      const { sql, params } = findCircularDeps(testId, 'cypher');
      expect(sql).toContain("cypher('recurrsive'");
      expect(sql).toContain('depends_on|imports');
      expect(params).toContain(testId);
    });

    it('limits recursive depth to 10 in SQL', () => {
      const { sql } = findCircularDeps(testId, 'sql');
      expect(sql).toContain('dw.depth < 10');
    });

    it('uses correct operator precedence for cycle detection', () => {
      const { sql } = findCircularDeps(testId, 'sql');
      // The OR condition must be grouped with parentheses
      expect(sql).toContain('AND (INSTR(dw.path, r.target_id) = 0 OR r.target_id = dw.start_id)');
    });
  });

  // ── findDeadCode ──────────────────────────────────────────────────────

  describe('findDeadCode', () => {
    it('generates SQL query finding unreferenced functions', () => {
      const { sql, params } = findDeadCode(testId, 'sql');
      expect(sql).toContain('repo_functions');
      expect(sql).toContain("type = 'function'");
      expect(sql).toContain("r.type = 'calls'");
      expect(sql).toContain('NOT EXISTS');
      expect(sql).not.toContain(testId);
      expect(params).toContain(testId);
    });

    it('generates Cypher query for dead code', () => {
      const { sql, params } = findDeadCode(testId, 'cypher');
      expect(sql).toContain("cypher('recurrsive'");
      expect(sql).toContain('NOT EXISTS');
      expect(sql).toContain(':function');
      expect(sql).toContain(':calls');
      expect(params).toContain(testId);
    });

    it('uses recursive CTE for ancestry traversal in SQL', () => {
      const { sql } = findDeadCode(testId, 'sql');
      expect(sql).toContain('WITH RECURSIVE ancestry');
      expect(sql).toContain("type = 'contains'");
    });
  });

  // ── findEntitiesByPattern ─────────────────────────────────────────────

  describe('findEntitiesByPattern', () => {
    it('generates SQL query with LIKE pattern matching', () => {
      const { sql, params } = findEntitiesByPattern('handleRequest', undefined, 'sql');
      expect(sql).toContain('LIKE ?');
      expect(params).toContain('%handleRequest%');
      expect(sql).toContain('e.name');
      expect(sql).toContain('e.qualified_name');
      expect(sql).toContain('ORDER BY e.name');
    });

    it('generates Cypher query with regex matching', () => {
      const { sql, params } = findEntitiesByPattern('handleRequest', undefined, 'cypher');
      expect(sql).toContain("cypher('recurrsive'");
      expect(sql).toContain('=~');
      expect(params).toContain('.*handleRequest.*');
    });

    it('includes entity type filter when provided', () => {
      const { sql, params } = findEntitiesByPattern('handler', 'function', 'sql');
      expect(sql).toContain('e.type = ?');
      expect(params).toContain('function');
    });

    it('omits entity type filter when not provided', () => {
      const { sql } = findEntitiesByPattern('handler', undefined, 'sql');
      expect(sql).not.toContain('e.type =');
    });

    it('does not interpolate patterns into SQL', () => {
      const { sql, params } = findEntitiesByPattern("it's", undefined, 'sql');
      // Pattern should be in params, not in the SQL string
      expect(params).toContain("%it's%");
      expect(sql).not.toContain("it's");
    });

    it('applies entity type filter in Cypher dialect', () => {
      const { sql } = findEntitiesByPattern('handler', 'function', 'cypher');
      expect(sql).toContain(':function');
    });
  });

  // ── findCallChain ─────────────────────────────────────────────────────

  describe('findCallChain', () => {
    it('generates SQL recursive CTE for call chain', () => {
      const { sql, params } = findCallChain(testId, 5, 'sql');
      expect(sql).toContain('WITH RECURSIVE call_chain');
      expect(sql).not.toContain(testId);
      expect(params).toContain(testId);
      expect(sql).toContain("r.type = 'calls'");
      expect(sql).toContain('cc.depth < ?');
      expect(params).toContain(5);
    });

    it('generates Cypher query for call chain', () => {
      const { sql, params } = findCallChain(testId, 3, 'cypher');
      expect(sql).toContain("cypher('recurrsive'");
      expect(sql).toContain(':calls*1..3');
      expect(params).toContain(testId);
    });

    it('uses default maxDepth of 5', () => {
      const { sql, params } = findCallChain(testId, undefined, 'sql');
      expect(params).toContain(5);
    });
  });

  // ── findAIWorkflow ────────────────────────────────────────────────────

  describe('findAIWorkflow', () => {
    it('generates SQL query joining agent relationships', () => {
      const { sql, params } = findAIWorkflow(testId, 'sql');
      expect(sql).not.toContain(testId);
      expect(params).toContain(testId);
      expect(sql).toContain("'uses_model'");
      expect(sql).toContain("'uses_tool'");
      expect(sql).toContain("'has_prompt'");
      expect(sql).toContain("'invokes_agent'");
    });

    it('generates Cypher query for AI workflow', () => {
      const { sql, params } = findAIWorkflow(testId, 'cypher');
      expect(sql).toContain("cypher('recurrsive'");
      expect(sql).toContain('uses_model|uses_tool|has_prompt|invokes_agent');
      expect(params).toContain(testId);
    });
  });

  // ── findAllPromptsForAgent ────────────────────────────────────────────

  describe('findAllPromptsForAgent', () => {
    it('generates SQL query for agent prompts', () => {
      const { sql, params } = findAllPromptsForAgent(testId, 'sql');
      expect(sql).not.toContain(testId);
      expect(params).toContain(testId);
      expect(sql).toContain("r.type = 'has_prompt'");
      expect(sql).toContain("p.type = 'prompt'");
      expect(sql).toContain('ORDER BY p.name');
    });

    it('generates Cypher query for agent prompts', () => {
      const { sql } = findAllPromptsForAgent(testId, 'cypher');
      expect(sql).toContain(':agent');
      expect(sql).toContain(':has_prompt');
      expect(sql).toContain(':prompt');
    });
  });

  // ── findModelUsage ────────────────────────────────────────────────────

  describe('findModelUsage', () => {
    it('generates SQL query for model usage', () => {
      const { sql } = findModelUsage('sql');
      expect(sql).toContain("r.type = 'uses_model'");
      expect(sql).toContain("m.type = 'model'");
      expect(sql).toContain('ORDER BY m.name, c.name');
    });

    it('generates Cypher query for model usage', () => {
      const { sql } = findModelUsage('cypher');
      expect(sql).toContain(':uses_model');
      expect(sql).toContain(':model');
    });
  });
});
