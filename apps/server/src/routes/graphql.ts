/**
 * @module @recurrsive/server/routes/graphql
 *
 * Lightweight, self-contained GraphQL API layer for the Recurrsive platform.
 *
 * Implements a regex-based GraphQL query parser that supports:
 * - Basic field selection (`{ projects { id name } }`)
 * - Simple arguments (`{ findings(severity: "critical", limit: 5) { id title } }`)
 * - Named queries (`query GetProjects { projects { id } }`)
 * - Proper GraphQL response format (`{ data, errors }`)
 *
 * No external GraphQL libraries are used — parsing and execution are
 * hand-rolled for this specific schema.
 *
 * Endpoints:
 * - `POST /api/v1/graphql`          — Execute a GraphQL query
 * - `GET  /api/v1/graphql/schema`   — Return the raw schema string
 * - `GET  /api/v1/graphql/introspection` — Return schema metadata as JSON
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { createLogger, generateId } from '@recurrsive/core';
import { state } from '../state.js';
import { authMiddleware } from '../middleware/auth.js';

const logger = createLogger({ context: { component: 'server:routes:graphql' } });

// ---------------------------------------------------------------------------
// Schema definition
// ---------------------------------------------------------------------------

const SCHEMA_SDL = `type Query {
  projects: [Project!]!
  project(id: ID!): Project
  findings(severity: String, analyzerId: String, limit: Int): [Finding!]!
  analyzers: [Analyzer!]!
  collectors: [Collector!]!
  healthScore: HealthScore!
  opportunities(limit: Int): [Opportunity!]!
}

type Project { id: ID!, name: String!, slug: String!, healthScore: Float!, language: String! }
type Finding { id: ID!, ruleId: String!, title: String!, severity: String!, analyzerId: String!, description: String! }
type Analyzer { id: ID!, name: String!, version: String!, ruleCount: Int! }
type Collector { id: ID!, name: String!, type: String!, version: String! }
type HealthScore { overall: Float!, dimensions: [Dimension!]! }
type Dimension { name: String!, score: Float! }
type Opportunity { id: ID!, title: String!, impact: String!, effort: String!, category: String! }`;

// ---------------------------------------------------------------------------
// Collector catalog (static list of known collector names)
// ---------------------------------------------------------------------------

const COLLECTOR_CATALOG: Array<{ name: string; type: string; version: string }> = [
  { name: 'Git Collector', type: 'vcs', version: '2.1.0' },
  { name: 'GitHub Collector', type: 'vcs', version: '1.5.2' },
  { name: 'GitLab Collector', type: 'vcs', version: '1.3.1' },
  { name: 'Documentation Collector', type: 'docs', version: '1.2.0' },
  { name: 'CI/CD Collector', type: 'pipeline', version: '1.4.0' },
  { name: 'Database Collector', type: 'database', version: '1.1.1' },
  { name: 'Environment Collector', type: 'runtime', version: '1.0.3' },
  { name: 'Telemetry Collector', type: 'observability', version: '2.0.0' },
  { name: 'Cloud Cost Collector', type: 'finops', version: '1.0.0' },
  { name: 'Error Tracking Collector', type: 'observability', version: '1.2.4' },
  { name: 'Package Registry Collector', type: 'registry', version: '0.9.0' },
  { name: 'Kubernetes Collector', type: 'orchestration', version: '1.1.0' },
  { name: 'Terraform Collector', type: 'iac', version: '1.0.2' },
  { name: 'Secrets Scanner Collector', type: 'security', version: '1.3.0' },
];

// ---------------------------------------------------------------------------
// Lightweight GraphQL query parser
// ---------------------------------------------------------------------------

/** Parsed argument value — string, number, boolean, or null. */
type ArgValue = string | number | boolean | null;

/** A single field requested in the selection set. */
interface ParsedField {
  /** The root query field name (e.g. `projects`, `findings`). */
  name: string;
  /** Arguments passed to the field. */
  args: Record<string, ArgValue>;
  /** Requested sub-fields (empty for scalars). */
  fields: string[];
}

/** Result of parsing a GraphQL query string. */
interface ParsedQuery {
  /** The operation type (only `query` is supported). */
  operationType: 'query';
  /** Optional operation name. */
  operationName: string | null;
  /** Top-level fields with their arguments and selection sets. */
  selections: ParsedField[];
}

/**
 * Parse a simplified GraphQL query string into a structured representation.
 *
 * Supports:
 * - Anonymous queries: `{ projects { id name } }`
 * - Named queries: `query GetData { projects { id } }`
 * - Arguments with string, int, float, boolean, null values
 * - Variable substitution in arguments
 *
 * Does NOT support: fragments, mutations, subscriptions, directives, aliases,
 * nested selections beyond one level.
 */
function parseQuery(
  queryStr: string,
  variables?: Record<string, unknown> | null,
): ParsedQuery {
  // Strip comments (lines starting with # or inline # comments)
  const cleaned = queryStr
    .replace(/#[^\n]*/g, '')
    .trim();

  // Extract operation type and name: `query OpName { ... }` or just `{ ... }`
  let operationName: string | null = null;
  let bodyStr: string;

  const opMatch = cleaned.match(
    /^(query|mutation|subscription)\s+(\w+)?\s*(?:\([^)]*\))?\s*\{([\s\S]*)\}\s*$/,
  );
  if (opMatch) {
    const opType = opMatch[1]!;
    if (opType !== 'query') {
      throw new GraphQLError(`Unsupported operation type: ${opType}. Only "query" is supported.`);
    }
    operationName = opMatch[2] ?? null;
    bodyStr = opMatch[3]!;
  } else {
    // Anonymous query: `{ ... }`
    const anonMatch = cleaned.match(/^\{([\s\S]*)\}\s*$/);
    if (!anonMatch) {
      throw new GraphQLError('Failed to parse query. Expected a query like: { fieldName { subField } }');
    }
    bodyStr = anonMatch[1]!;
  }

  const selections = parseSelections(bodyStr, variables ?? null);

  return { operationType: 'query', operationName, selections };
}

/**
 * Parse top-level field selections from the body of a query.
 *
 * Handles patterns like:
 *   `projects { id name healthScore }`
 *   `findings(severity: "critical", limit: 5) { id title }`
 *   `healthScore { overall dimensions { name score } }`
 */
function parseSelections(
  body: string,
  variables: Record<string, unknown> | null,
): ParsedField[] {
  const selections: ParsedField[] = [];

  // Regex to match: fieldName(args) { subfields } or fieldName { subfields }
  // We need to handle nested braces for the selection set.
  const fieldRegex = /(\w+)\s*(?:\(([^)]*)\))?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = fieldRegex.exec(body)) !== null) {
    const name = match[1]!;
    const rawArgs = match[2] ?? '';
    const rawFields = match[3]!;

    const args = parseArguments(rawArgs, variables);
    const fields = parseFieldNames(rawFields);

    selections.push({ name, args, fields });
  }

  // Also handle scalar fields without sub-selections at the top level
  // (uncommon for root queries but supported)
  const scalarRegex = /(?:^|[\s,])(\w+)(?=\s*(?:$|[\s,]))/g;
  const usedNames = new Set(selections.map((s) => s.name));
  // Reset and scan for scalars not already captured
  const stripped = body.replace(fieldRegex, '');
  let scalarMatch: RegExpExecArray | null;
  while ((scalarMatch = scalarRegex.exec(stripped)) !== null) {
    const scalarName = scalarMatch[1]!.trim();
    if (scalarName && !usedNames.has(scalarName)) {
      selections.push({ name: scalarName, args: {}, fields: [] });
      usedNames.add(scalarName);
    }
  }

  if (selections.length === 0) {
    throw new GraphQLError('No fields found in query selection set.');
  }

  return selections;
}

/**
 * Parse comma-separated argument strings like:
 *   `severity: "critical", limit: 5, enabled: true`
 */
function parseArguments(
  raw: string,
  variables: Record<string, unknown> | null,
): Record<string, ArgValue> {
  const args: Record<string, ArgValue> = {};
  if (!raw.trim()) return args;

  // Match key: value pairs (value can be string, number, boolean, null, or $variable)
  const argRegex = /(\w+)\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?|true|false|null|\$\w+)/g;
  let match: RegExpExecArray | null;

  while ((match = argRegex.exec(raw)) !== null) {
    const key = match[1]!;
    const rawValue = match[2]!;

    // Variable substitution
    if (rawValue.startsWith('$')) {
      const varName = rawValue.slice(1);
      const varValue = variables?.[varName];
      if (varValue === undefined) {
        throw new GraphQLError(`Variable "$${varName}" is not defined.`);
      }
      args[key] = varValue as ArgValue;
      continue;
    }

    // String literal (strip quotes and unescape)
    if ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
      args[key] = rawValue.slice(1, -1).replace(/\\(.)/g, '$1');
      continue;
    }

    // Boolean / null
    if (rawValue === 'true') { args[key] = true; continue; }
    if (rawValue === 'false') { args[key] = false; continue; }
    if (rawValue === 'null') { args[key] = null; continue; }

    // Number
    const num = Number(rawValue);
    if (!Number.isNaN(num)) { args[key] = num; continue; }

    args[key] = rawValue;
  }

  return args;
}

/**
 * Extract flat field names from a selection set string.
 * Handles nested selections by also extracting sub-object field names.
 *
 * E.g. `id name dimensions { name score }` → ['id', 'name', 'dimensions']
 * (the resolver is responsible for populating sub-objects)
 */
function parseFieldNames(raw: string): string[] {
  const names: string[] = [];
  // Remove nested braces content first, keeping the field name before the brace
  const flattened = raw.replace(/\{[^}]*\}/g, '');
  const tokens = flattened.split(/[\s,]+/).filter(Boolean);
  for (const token of tokens) {
    if (/^\w+$/.test(token) && !names.includes(token)) {
      names.push(token);
    }
  }
  return names;
}

// ---------------------------------------------------------------------------
// GraphQL error class
// ---------------------------------------------------------------------------

class GraphQLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphQLError';
  }
}

// ---------------------------------------------------------------------------
// Field selector: filters an object to only requested fields
// ---------------------------------------------------------------------------

/**
 * Return a new object containing only the requested fields.
 * If `fields` is empty, return the full object (no filtering).
 */
function selectFields<T extends Record<string, unknown>>(
  obj: T,
  fields: string[],
): Partial<T> {
  if (fields.length === 0) return { ...obj };
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in obj) {
      result[field] = obj[field as keyof T];
    }
  }
  return result as Partial<T>;
}

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------

type ResolverFn = (
  args: Record<string, ArgValue>,
  fields: string[],
) => unknown;

function buildResolvers(): Record<string, ResolverFn> {
  return {
    projects: (_args, fields) => {
      // Use live data from analysis cache if available
      const cache = state.isInitialized() ? state.getAnalysisCache() : null;
      if (cache) {
        // Extract unique project references from findings
        const projectMap = new Map<string, Record<string, unknown>>();
        for (const f of cache.findings) {
          const loc = (f as Record<string, unknown>)['location'] as Record<string, unknown> | undefined;
          const filePath = loc?.['file'] as string ?? 'unknown';
          const slug = filePath.split('/')[0] ?? 'default-project';
          if (!projectMap.has(slug)) {
            projectMap.set(slug, {
              id: generateId(),
              name: slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              slug,
              healthScore: state.isInitialized() ? state.getHealthScore().overall : 0,
              language: 'TypeScript',
            });
          }
        }
        const projects = [...projectMap.values()];
        return projects.map((p) => selectFields(p, fields));
      }
      return [];
    },

    project: (args, _fields) => {
      const id = args['id'] as string | undefined;
      if (!id) throw new GraphQLError('Argument "id" is required for field "project".');
      // No seed data — only live data is available when state is initialized
      return null;
    },

    findings: (args, fields) => {
      // Use live findings from analysis cache if available
      const cache = state.isInitialized() ? state.getAnalysisCache() : null;
      const sourceFindings = cache?.findings ?? null;

      if (sourceFindings && sourceFindings.length > 0) {
        let results = sourceFindings.map((f) => {
          const raw = f as unknown as Record<string, unknown>;
          return {
            id: (raw['id'] as string) ?? generateId(),
            ruleId: (raw['rule_id'] as string) ?? 'UNKNOWN',
            title: (raw['title'] as string) ?? (raw['message'] as string) ?? 'Untitled finding',
            severity: (raw['severity'] as string) ?? 'medium',
            analyzerId: (raw['analyzer_id'] as string) ?? 'unknown',
            description: (raw['description'] as string) ?? (raw['message'] as string) ?? '',
          };
        });

        const severity = args['severity'];
        if (severity && typeof severity === 'string') {
          const sev = severity.toLowerCase();
          results = results.filter((f) => f.severity === sev);
        }

        const analyzerId = args['analyzerId'];
        if (analyzerId && typeof analyzerId === 'string') {
          results = results.filter((f) => f.analyzerId === analyzerId);
        }

        const limit = args['limit'];
        if (typeof limit === 'number' && limit > 0) {
          results = results.slice(0, limit);
        }

        return results.map((f) => selectFields(f as unknown as Record<string, unknown>, fields));
      }

      // No live findings available
      return [];
    },

    analyzers: (_args, fields) => {
      // Use real analyzers from the analyzer registry if the server is initialized
      const cache = state.isInitialized() ? state.getAnalysisCache() : null;
      if (cache) {
        const analysisResult = cache as unknown as Record<string, unknown>;
        const ran = (analysisResult['analyzers_run'] as string[] | undefined) ?? [];
        if (ran.length > 0) {
          const liveAnalyzers = ran.map((name) => ({
            id: generateId(),
            name: name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            version: '0.6.0',
            ruleCount: name.length * 2 + 5, // deterministic from name length
          }));
          return liveAnalyzers.map((a) => selectFields(a as unknown as Record<string, unknown>, fields));
        }
      }
      return [];
    },

    collectors: (_args, fields) => {
      return COLLECTOR_CATALOG.map((c) => selectFields(
        { id: generateId(), ...c } as unknown as Record<string, unknown>,
        fields,
      ));
    },

    healthScore: (_args, fields) => {
      // Use live health score if available
      const cache = state.isInitialized() ? state.getAnalysisCache() : null;
      if (cache) {
        const analysisResult = cache as unknown as Record<string, unknown>;
        const healthData = analysisResult['health_score'] as Record<string, unknown> | undefined;
        if (healthData) {
          const result: Record<string, unknown> = {};
          if (fields.length === 0 || fields.includes('overall')) {
            result['overall'] = healthData['overall'] ?? 0;
          }
          if (fields.length === 0 || fields.includes('dimensions')) {
            const dims = healthData['dimensions'] as Array<Record<string, unknown>> | undefined;
            result['dimensions'] = dims ?? [];
          }
          return result;
        }
      }

      // No live data — return empty defaults
      const result: Record<string, unknown> = {};
      if (fields.length === 0 || fields.includes('overall')) {
        result['overall'] = 0;
      }
      if (fields.length === 0 || fields.includes('dimensions')) {
        result['dimensions'] = [];
      }
      return result;
    },

    opportunities: (args, fields) => {
      // Use live opportunities from analysis cache if available
      const cache = state.isInitialized() ? state.getAnalysisCache() : null;
      const sourceOpps = cache?.opportunities ?? null;

      if (sourceOpps && sourceOpps.length > 0) {
        let results = sourceOpps.map((o) => {
          const raw = o as unknown as Record<string, unknown>;
          return {
            id: (raw['id'] as string) ?? generateId(),
            title: (raw['title'] as string) ?? 'Untitled opportunity',
            impact: (raw['impact'] as string) ?? 'medium',
            effort: (raw['effort'] as string) ?? 'medium',
            category: (raw['category'] as string) ?? 'general',
          };
        });

        const limit = args['limit'];
        if (typeof limit === 'number' && limit > 0) {
          results = results.slice(0, limit);
        }

        return results.map((o) => selectFields(o as unknown as Record<string, unknown>, fields));
      }

      // No live opportunities available
      return [];
    },
  };
}

const resolvers = buildResolvers();

// ---------------------------------------------------------------------------
// Query executor
// ---------------------------------------------------------------------------

interface GraphQLResponse {
  data: Record<string, unknown> | null;
  errors?: Array<{ message: string; path?: string[] }>;
}

/**
 * Execute a parsed GraphQL query against the resolvers.
 */
function executeQuery(parsed: ParsedQuery): GraphQLResponse {
  const data: Record<string, unknown> = {};
  const errors: Array<{ message: string; path?: string[] }> = [];

  for (const selection of parsed.selections) {
    const resolver = resolvers[selection.name];
    if (!resolver) {
      errors.push({
        message: `Unknown field "${selection.name}" on type "Query".`,
        path: [selection.name],
      });
      continue;
    }

    try {
      data[selection.name] = resolver(selection.args, selection.fields);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ message, path: [selection.name] });
    }
  }

  const response: GraphQLResponse = { data: Object.keys(data).length > 0 ? data : null };
  if (errors.length > 0) {
    response.errors = errors;
  }

  return response;
}

// ---------------------------------------------------------------------------
// Introspection metadata
// ---------------------------------------------------------------------------

interface FieldMeta {
  name: string;
  type: string;
  args?: Array<{ name: string; type: string }>;
}

interface TypeMeta {
  name: string;
  kind: 'OBJECT' | 'SCALAR' | 'LIST' | 'NON_NULL';
  fields: FieldMeta[] | null;
}

function buildIntrospection(): { types: TypeMeta[]; queryType: { name: string } } {
  const types: TypeMeta[] = [
    {
      name: 'Query',
      kind: 'OBJECT',
      fields: [
        { name: 'projects', type: '[Project!]!' },
        { name: 'project', type: 'Project', args: [{ name: 'id', type: 'ID!' }] },
        {
          name: 'findings',
          type: '[Finding!]!',
          args: [
            { name: 'severity', type: 'String' },
            { name: 'analyzerId', type: 'String' },
            { name: 'limit', type: 'Int' },
          ],
        },
        { name: 'analyzers', type: '[Analyzer!]!' },
        { name: 'collectors', type: '[Collector!]!' },
        { name: 'healthScore', type: 'HealthScore!' },
        { name: 'opportunities', type: '[Opportunity!]!', args: [{ name: 'limit', type: 'Int' }] },
      ],
    },
    {
      name: 'Project',
      kind: 'OBJECT',
      fields: [
        { name: 'id', type: 'ID!' },
        { name: 'name', type: 'String!' },
        { name: 'slug', type: 'String!' },
        { name: 'healthScore', type: 'Float!' },
        { name: 'language', type: 'String!' },
      ],
    },
    {
      name: 'Finding',
      kind: 'OBJECT',
      fields: [
        { name: 'id', type: 'ID!' },
        { name: 'ruleId', type: 'String!' },
        { name: 'title', type: 'String!' },
        { name: 'severity', type: 'String!' },
        { name: 'analyzerId', type: 'String!' },
        { name: 'description', type: 'String!' },
      ],
    },
    {
      name: 'Analyzer',
      kind: 'OBJECT',
      fields: [
        { name: 'id', type: 'ID!' },
        { name: 'name', type: 'String!' },
        { name: 'version', type: 'String!' },
        { name: 'ruleCount', type: 'Int!' },
      ],
    },
    {
      name: 'Collector',
      kind: 'OBJECT',
      fields: [
        { name: 'id', type: 'ID!' },
        { name: 'name', type: 'String!' },
        { name: 'type', type: 'String!' },
        { name: 'version', type: 'String!' },
      ],
    },
    {
      name: 'HealthScore',
      kind: 'OBJECT',
      fields: [
        { name: 'overall', type: 'Float!' },
        { name: 'dimensions', type: '[Dimension!]!' },
      ],
    },
    {
      name: 'Dimension',
      kind: 'OBJECT',
      fields: [
        { name: 'name', type: 'String!' },
        { name: 'score', type: 'Float!' },
      ],
    },
    {
      name: 'Opportunity',
      kind: 'OBJECT',
      fields: [
        { name: 'id', type: 'ID!' },
        { name: 'title', type: 'String!' },
        { name: 'impact', type: 'String!' },
        { name: 'effort', type: 'String!' },
        { name: 'category', type: 'String!' },
      ],
    },
    // Scalar types
    { name: 'ID', kind: 'SCALAR', fields: null },
    { name: 'String', kind: 'SCALAR', fields: null },
    { name: 'Int', kind: 'SCALAR', fields: null },
    { name: 'Float', kind: 'SCALAR', fields: null },
    { name: 'Boolean', kind: 'SCALAR', fields: null },
  ];

  return { types, queryType: { name: 'Query' } };
}

const INTROSPECTION = buildIntrospection();

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

interface GraphQLRequestBody {
  query: string;
  variables?: Record<string, unknown> | null;
  operationName?: string | null;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register GraphQL API routes.
 *
 * @param app - Fastify instance.
 */
export async function registerGraphQLRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/graphql
   *
   * Execute a GraphQL query. Accepts JSON body with `query` (required),
   * `variables` (optional), and `operationName` (optional).
   */
  app.post<{ Body: GraphQLRequestBody }>('/api/v1/graphql', { preHandler: [authMiddleware] }, async (request, reply) => {
    const startTime = Date.now();

    const body = request.body;
    if (!body || typeof body.query !== 'string' || !body.query.trim()) {
      return reply.status(400).send({
        data: null,
        errors: [{ message: 'Request body must include a non-empty "query" string.' }],
      });
    }

    try {
      const parsed = parseQuery(body.query, body.variables ?? null);
      const result = executeQuery(parsed);

      const durationMs = Date.now() - startTime;
      logger.info(`GraphQL query executed in ${durationMs}ms`, {
        operationName: parsed.operationName,
        fieldCount: parsed.selections.length,
      });

      return reply.status(200).send(result);
    } catch (err) {
      const message = err instanceof GraphQLError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Internal server error during query execution.';

      logger.warn(`GraphQL query error: ${message}`);

      return reply.status(200).send({
        data: null,
        errors: [{ message }],
      });
    }
  });

  /**
   * GET /api/v1/graphql/schema
   *
   * Returns the raw GraphQL schema definition language (SDL) string.
   */
  app.get('/api/v1/graphql/schema', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.status(200).header('content-type', 'text/plain; charset=utf-8').send(SCHEMA_SDL);
  });

  /**
   * GET /api/v1/graphql/introspection
   *
   * Returns schema metadata in JSON format, similar to a simplified
   * `__schema` introspection query response.
   */
  app.get('/api/v1/graphql/introspection', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.status(200).send({
      data: {
        __schema: INTROSPECTION,
      },
    });
  });

  logger.info('GraphQL routes registered: POST /api/v1/graphql, GET /api/v1/graphql/schema, GET /api/v1/graphql/introspection');
}
