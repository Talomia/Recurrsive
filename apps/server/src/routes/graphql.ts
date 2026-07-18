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
import { createLogger, VERSION } from '@recurrsive/core';
import { state } from '../state.js';
import { store } from '../store.js';
import { authMiddleware } from '../middleware/auth.js';
import { ALL_ANALYZER_IDS, ALL_COLLECTOR_IDS } from './config.js';

const logger = createLogger({ context: { component: 'server:routes:graphql' } });

// ---------------------------------------------------------------------------
// Schema definition
// ---------------------------------------------------------------------------

const SCHEMA_SDL = `type Query {
  projects: [Project!]!
  project(id: ID!): Project
  findings(severity: String, analyzerId: String, limit: Int, projectId: String): [Finding!]!
  analyzers: [Analyzer!]!
  collectors: [Collector!]!
  healthScore(projectId: String): HealthScore!
  opportunities(limit: Int, projectId: String): [Opportunity!]!
}

type Project { id: ID!, name: String!, slug: String!, healthScore: Float!, language: String! }
type Finding { id: ID!, ruleId: String!, title: String!, severity: String!, analyzerId: String!, description: String! }
type Analyzer { id: ID!, name: String!, version: String! }
type Collector { id: ID!, name: String!, type: String!, version: String! }
type HealthScore { overall: Float!, dimensions: [Dimension!]! }
type Dimension { name: String!, score: Float! }
type Opportunity { id: ID!, title: String!, impact: String!, effort: String!, category: String! }`;

// ---------------------------------------------------------------------------
// Collector catalog — the real built-in collectors and their domains. These
// mirror ALL_COLLECTOR_IDS (the same set the REST config endpoint enforces);
// versions are the platform version since collectors ship with the platform.
// ---------------------------------------------------------------------------

const COLLECTOR_TYPES: Record<string, string> = {
  git: 'vcs',
  documentation: 'docs',
  environment: 'runtime',
  cicd: 'pipeline',
  database: 'database',
};

/** A displayable project as exposed by the GraphQL layer. */
interface StoredProject {
  id: string;
  name: string;
  slug: string;
  language: string;
  healthScore: number;
}

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
) => unknown | Promise<unknown>;

/** Resolve the analysis cache for an optional `projectId` argument. */
async function cacheForArg(args: Record<string, ArgValue>): Promise<{ findings: unknown[]; opportunities: unknown[]; health_score?: unknown } | null> {
  if (!state.isInitialized()) return null;
  const projectId = typeof args['projectId'] === 'string' ? (args['projectId'] as string) : undefined;
  return (await state.loadCacheForProject(projectId)) as unknown as { findings: unknown[]; opportunities: unknown[]; health_score?: unknown } | null;
}

function buildResolvers(): Record<string, ResolverFn> {
  return {
    projects: async (_args, fields) => {
      // Read the real project registry — the same store the REST API serves.
      const projects = await store.all<StoredProject>('projects');
      return projects.map((p) => selectFields(
        {
          id: p.id,
          name: p.name,
          slug: p.slug,
          healthScore: p.healthScore,
          language: p.language,
        },
        fields,
      ));
    },

    project: async (args, fields) => {
      const id = args['id'] as string | undefined;
      if (!id) throw new GraphQLError('Argument "id" is required for field "project".');
      const p = await store.get<StoredProject>('projects', id);
      if (!p) return null;
      return selectFields(
        {
          id: p.id,
          name: p.name,
          slug: p.slug,
          healthScore: p.healthScore,
          language: p.language,
        },
        fields,
      );
    },

    findings: async (args, fields) => {
      const cache = await cacheForArg(args);
      const sourceFindings = cache?.findings ?? null;

      if (sourceFindings && sourceFindings.length > 0) {
        let results = sourceFindings.map((f) => {
          const raw = f as Record<string, unknown>;
          return {
            id: raw['id'] as string,
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
      // The real built-in analyzer set. When an analysis has run, expose only
      // the analyzers that actually ran; otherwise list the full built-in set.
      const cache = state.isInitialized() ? state.getAnalysisCache() : null;
      const ran = (cache as unknown as Record<string, unknown> | null)?.['analyzers_run'] as string[] | undefined;
      const ids = ran && ran.length > 0 ? ran : [...ALL_ANALYZER_IDS];
      return ids.map((id) => selectFields(
        {
          id,
          name: id.replace(/[.-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          version: VERSION,
        },
        fields,
      ));
    },

    collectors: (_args, fields) => {
      // The real built-in collectors (mirrors ALL_COLLECTOR_IDS).
      return ALL_COLLECTOR_IDS.map((id) => selectFields(
        {
          id,
          name: id.replace(/[.-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          type: COLLECTOR_TYPES[id] ?? 'general',
          version: VERSION,
        },
        fields,
      ));
    },

    healthScore: async (args, fields) => {
      const cache = await cacheForArg(args);
      const healthData = cache?.health_score as Record<string, unknown> | undefined;
      const result: Record<string, unknown> = {};
      if (fields.length === 0 || fields.includes('overall')) {
        result['overall'] = healthData?.['overall'] ?? 0;
      }
      if (fields.length === 0 || fields.includes('dimensions')) {
        result['dimensions'] = (healthData?.['dimensions'] as Array<Record<string, unknown>> | undefined) ?? [];
      }
      return result;
    },

    opportunities: async (args, fields) => {
      const cache = await cacheForArg(args);
      const sourceOpps = cache?.opportunities ?? null;

      if (sourceOpps && sourceOpps.length > 0) {
        let results = sourceOpps.map((o) => {
          const raw = o as Record<string, unknown>;
          return {
            id: raw['id'] as string,
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
async function executeQuery(parsed: ParsedQuery): Promise<GraphQLResponse> {
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
      data[selection.name] = await resolver(selection.args, selection.fields);
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
      const result = await executeQuery(parsed);

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
