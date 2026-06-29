/**
 * @module queries/builders
 *
 * Reusable query builder functions that produce either Cypher (for
 * PostgreSQL + Apache AGE) or SQL (for SQLite) query strings.
 *
 * All builder functions accept a `dialect` parameter to select the
 * output format.
 *
 * @packageDocumentation
 */

/** Supported query dialects. */
export type QueryDialect = 'cypher' | 'sql';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Wrap a Cypher expression in the AGE `cypher()` function call so it
 * can be executed as a regular SQL query against PostgreSQL.
 *
 * @param cypher - Raw Cypher query body.
 * @param returnColumns - Column aliases for the `AS (...)` clause.
 * @returns Full SQL statement for AGE.
 */
function wrapAge(cypher: string, returnColumns = 'result agtype'): string {
  return `SELECT * FROM cypher('recurrsive', $$ ${cypher} $$) AS (${returnColumns});`;
}

// ---------------------------------------------------------------------------
// Query Builders
// ---------------------------------------------------------------------------

/**
 * Build a query that traces the call chain starting from a function
 * entity, walking up to `maxDepth` hops along `calls` edges.
 *
 * @param functionId - UUID of the starting function entity.
 * @param maxDepth - Maximum traversal depth (default `5`).
 * @param dialect - Target dialect.
 * @returns Query string.
 */
export function findCallChain(
  functionId: string,
  maxDepth: number = 5,
  dialect: QueryDialect = 'cypher',
): string {
  if (dialect === 'cypher') {
    return wrapAge(
      `MATCH path = (f:function {id: '${functionId}'})-[:calls*1..${maxDepth}]->(target) RETURN path`,
      'path agtype',
    );
  }

  // SQLite: recursive CTE following calls relationships
  return `
WITH RECURSIVE call_chain(entity_id, depth, path) AS (
  SELECT '${functionId}', 0, '${functionId}'
  UNION ALL
  SELECT r.target_id, cc.depth + 1, cc.path || ',' || r.target_id
  FROM call_chain cc
  JOIN relationships r ON r.source_id = cc.entity_id AND r.type = 'calls'
  WHERE cc.depth < ${maxDepth}
    AND INSTR(cc.path, r.target_id) = 0
)
SELECT DISTINCT e.*
FROM call_chain cc
JOIN entities e ON e.id = cc.entity_id
ORDER BY cc.depth;
  `.trim();
}

/**
 * Build a query that finds the full dependency tree for an entity,
 * following `depends_on`, `imports`, and `references` edges.
 *
 * @param entityId - UUID of the root entity.
 * @param dialect - Target dialect.
 * @returns Query string.
 */
export function findDependencyTree(
  entityId: string,
  dialect: QueryDialect = 'cypher',
): string {
  if (dialect === 'cypher') {
    return wrapAge(
      `MATCH path = (root {id: '${entityId}'})-[:depends_on|imports|references*]->(dep) RETURN path`,
      'path agtype',
    );
  }

  return `
WITH RECURSIVE dep_tree(entity_id, depth, path) AS (
  SELECT '${entityId}', 0, '${entityId}'
  UNION ALL
  SELECT r.target_id, dt.depth + 1, dt.path || ',' || r.target_id
  FROM dep_tree dt
  JOIN relationships r ON r.source_id = dt.entity_id
    AND r.type IN ('depends_on', 'imports', 'references')
  WHERE dt.depth < 20
    AND INSTR(dt.path, r.target_id) = 0
)
SELECT DISTINCT e.*
FROM dep_tree dt
JOIN entities e ON e.id = dt.entity_id
ORDER BY dt.depth;
  `.trim();
}

/**
 * Build a query that finds the full AI workflow for an agent — the
 * models it uses, tools it invokes, prompts it holds, and other
 * agents it delegates to.
 *
 * @param agentId - UUID of the agent entity.
 * @param dialect - Target dialect.
 * @returns Query string.
 */
export function findAIWorkflow(
  agentId: string,
  dialect: QueryDialect = 'cypher',
): string {
  if (dialect === 'cypher') {
    return wrapAge(
      `MATCH (a:agent {id: '${agentId}'})-[r:uses_model|uses_tool|has_prompt|invokes_agent|retrieves_from|embeds_with|evaluates_with]->(target) RETURN a, r, target`,
      'agent agtype, rel agtype, target agtype',
    );
  }

  return `
SELECT e.*, r.type AS rel_type, r.id AS rel_id, r.properties AS rel_properties,
       t.id AS target_id, t.type AS target_type, t.name AS target_name,
       t.qualified_name AS target_qualified_name, t.properties AS target_properties
FROM entities e
JOIN relationships r ON r.source_id = e.id
JOIN entities t ON t.id = r.target_id
WHERE e.id = '${agentId}'
  AND r.type IN ('uses_model', 'uses_tool', 'has_prompt', 'invokes_agent',
                 'retrieves_from', 'embeds_with', 'evaluates_with');
  `.trim();
}

/**
 * Build a query to discover potentially dead code — functions that
 * are never called by anything else within a given repository.
 *
 * @param repoId - UUID of the repository entity.
 * @param dialect - Target dialect.
 * @returns Query string.
 */
export function findDeadCode(
  repoId: string,
  dialect: QueryDialect = 'cypher',
): string {
  if (dialect === 'cypher') {
    return wrapAge(
      `MATCH (repo:repository {id: '${repoId}'})-[:contains*]->(f:function) WHERE NOT EXISTS { MATCH ()-[:calls]->(f) } RETURN f`,
      'f agtype',
    );
  }

  return `
WITH repo_functions AS (
  SELECT e.id
  FROM entities e
  JOIN relationships r_contains ON r_contains.target_id = e.id
    AND r_contains.type = 'contains'
  WHERE e.type = 'function'
    AND EXISTS (
      WITH RECURSIVE ancestry(eid) AS (
        SELECT '${repoId}'
        UNION ALL
        SELECT rc.target_id
        FROM ancestry a
        JOIN relationships rc ON rc.source_id = a.eid AND rc.type = 'contains'
      )
      SELECT 1 FROM ancestry WHERE eid = r_contains.source_id
    )
)
SELECT e.*
FROM entities e
JOIN repo_functions rf ON rf.id = e.id
WHERE NOT EXISTS (
  SELECT 1 FROM relationships r
  WHERE r.target_id = e.id AND r.type = 'calls'
);
  `.trim();
}

/**
 * Build a query to find circular dependency chains within a
 * repository.
 *
 * @param repoId - UUID of the repository entity.
 * @param dialect - Target dialect.
 * @returns Query string.
 */
export function findCircularDeps(
  repoId: string,
  dialect: QueryDialect = 'cypher',
): string {
  if (dialect === 'cypher') {
    return wrapAge(
      `MATCH path = (a)-[:depends_on|imports*2..10]->(a) WHERE EXISTS { MATCH (repo:repository {id: '${repoId}'})-[:contains*]->(a) } RETURN path`,
      'path agtype',
    );
  }

  // SQLite: find cycles via recursive CTE with path tracking
  return `
WITH RECURSIVE dep_walk(start_id, current_id, depth, path, is_cycle) AS (
  SELECT r.source_id, r.target_id, 1,
         r.source_id || ',' || r.target_id,
         CASE WHEN r.source_id = r.target_id THEN 1 ELSE 0 END
  FROM relationships r
  WHERE r.type IN ('depends_on', 'imports')
  UNION ALL
  SELECT dw.start_id, r.target_id, dw.depth + 1,
         dw.path || ',' || r.target_id,
         CASE WHEN r.target_id = dw.start_id THEN 1 ELSE 0 END
  FROM dep_walk dw
  JOIN relationships r ON r.source_id = dw.current_id
    AND r.type IN ('depends_on', 'imports')
  WHERE dw.depth < 10
    AND dw.is_cycle = 0
    AND INSTR(dw.path, r.target_id) = 0
        OR r.target_id = dw.start_id
)
SELECT DISTINCT dw.path, dw.depth
FROM dep_walk dw
WHERE dw.is_cycle = 1
ORDER BY dw.depth;
  `.trim();
}

/**
 * Build a query to find all prompts associated with a specific agent.
 *
 * @param agentId - UUID of the agent entity.
 * @param dialect - Target dialect.
 * @returns Query string.
 */
export function findAllPromptsForAgent(
  agentId: string,
  dialect: QueryDialect = 'cypher',
): string {
  if (dialect === 'cypher') {
    return wrapAge(
      `MATCH (a:agent {id: '${agentId}'})-[:has_prompt]->(p:prompt) RETURN p`,
      'p agtype',
    );
  }

  return `
SELECT p.*
FROM entities p
JOIN relationships r ON r.target_id = p.id
WHERE r.source_id = '${agentId}'
  AND r.type = 'has_prompt'
  AND p.type = 'prompt'
ORDER BY p.name;
  `.trim();
}

/**
 * Build a query to find all model usage across the graph — which
 * agents or functions use which models.
 *
 * @param dialect - Target dialect.
 * @returns Query string.
 */
export function findModelUsage(
  dialect: QueryDialect = 'cypher',
): string {
  if (dialect === 'cypher') {
    return wrapAge(
      `MATCH (consumer)-[:uses_model]->(m:model) RETURN consumer, m`,
      'consumer agtype, model agtype',
    );
  }

  return `
SELECT c.id AS consumer_id, c.type AS consumer_type, c.name AS consumer_name,
       m.id AS model_id, m.name AS model_name, m.properties AS model_properties,
       r.properties AS usage_properties
FROM relationships r
JOIN entities c ON c.id = r.source_id
JOIN entities m ON m.id = r.target_id
WHERE r.type = 'uses_model'
  AND m.type = 'model'
ORDER BY m.name, c.name;
  `.trim();
}

/**
 * Build a query to find entities whose name or qualified_name matches
 * a pattern, optionally filtered by entity type.
 *
 * @param pattern - Search pattern (uses `LIKE`/`CONTAINS` semantics).
 * @param entityType - Optional entity type filter.
 * @param dialect - Target dialect.
 * @returns Query string.
 */
export function findEntitiesByPattern(
  pattern: string,
  entityType?: string,
  dialect: QueryDialect = 'cypher',
): string {
  // Escape single-quotes in the pattern for SQL safety
  const safePattern = pattern.replace(/'/g, "''");

  if (dialect === 'cypher') {
    const typeFilter = entityType ? `:${entityType}` : '';
    return wrapAge(
      `MATCH (n${typeFilter}) WHERE n.name =~ '.*${safePattern}.*' OR n.qualified_name =~ '.*${safePattern}.*' RETURN n`,
      'n agtype',
    );
  }

  const typeClause = entityType ? `AND e.type = '${entityType}'` : '';
  return `
SELECT e.*
FROM entities e
WHERE (e.name LIKE '%${safePattern}%' OR e.qualified_name LIKE '%${safePattern}%')
  ${typeClause}
ORDER BY e.name;
  `.trim();
}
