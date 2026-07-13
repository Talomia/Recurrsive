/** Standards-compliant, project-scoped GraphQL API. */
import type { FastifyInstance } from 'fastify';
import { VERSION, createLogger } from '@recurrsive/core';
import {
  buildSchema,
  execute,
  getIntrospectionQuery,
  graphql,
  GraphQLError,
  Kind,
  parse,
  printSchema,
  specifiedRules,
  validate,
  type DocumentNode,
  type FragmentDefinitionNode,
  type SelectionSetNode,
} from 'graphql';
import type { AnalysisCache } from '../state.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireProjectScope, type FindingWorkflowStates } from '../project-analysis.js';
import { store } from '../store.js';
import { calculateHealthScore } from '../analysis-metrics.js';

const logger = createLogger({ context: { component: 'server:routes:graphql' } });

const SCHEMA_SDL = `
  enum Severity { critical high medium low info }
  enum FindingStatus { open resolved suppressed }

  type Query {
    project: Project!
    finding(id: ID!): Finding
    findings(severity: Severity, analyzerId: String, category: String, status: FindingStatus, limit: Int = 50, offset: Int = 0): FindingConnection!
    analyzers: [Analyzer!]!
    collectors: [Collector!]!
    healthScore: HealthScore!
    opportunity(id: ID!): Opportunity
    opportunities(severity: Severity, status: String, limit: Int = 50, offset: Int = 0): OpportunityConnection!
  }

  type Project {
    id: ID!
    name: String!
    slug: String!
    repository: String!
    language: String!
    healthScore: Float!
    analyzedAt: String
  }

  type FindingConnection { nodes: [Finding!]!, total: Int!, limit: Int!, offset: Int! }
  type Finding {
    id: ID!
    ruleId: String!
    title: String!
    severity: Severity!
    category: String!
    analyzerId: String!
    description: String!
    status: FindingStatus!
    assignee: String!
  }

  type Analyzer { id: ID!, name: String!, version: String!, ruleCount: Int }
  type Collector { id: ID!, name: String!, type: String!, version: String! }
  type HealthScore { overall: Float!, dimensions: [Dimension!]!, findingCount: Int!, opportunityCount: Int! }
  type Dimension { name: String!, score: Float! }

  type OpportunityConnection { nodes: [Opportunity!]!, total: Int!, limit: Int!, offset: Int! }
  type Opportunity {
    id: ID!
    title: String!
    severity: Severity!
    status: String!
    confidence: Float!
    impact: String!
    effort: String!
    category: String!
    description: String!
  }
`;

const schema = buildSchema(SCHEMA_SDL);

const COLLECTOR_CATALOG: Record<string, { name: string; type: string }> = {
  git: { name: 'Git Collector', type: 'vcs' },
  documentation: { name: 'Documentation Collector', type: 'docs' },
  cicd: { name: 'CI/CD Collector', type: 'pipeline' },
  database: { name: 'Database Collector', type: 'database' },
  environment: { name: 'Environment Collector', type: 'runtime' },
};

interface ScopedProject {
  id: string;
  name: string;
  slug: string;
  repository: string;
  language: string;
  settings: { analyzers: string[]; collectors: string[] };
}

interface GraphQLRequestBody {
  query: string;
  variables?: Record<string, unknown> | null;
  operationName?: string | null;
}

interface PaginationArgs {
  limit?: number;
  offset?: number;
}

function pagination(args: PaginationArgs): { limit: number; offset: number } {
  const limit = args.limit ?? 50;
  const offset = args.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new GraphQLError('limit must be an integer between 1 and 500.');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new GraphQLError('offset must be a non-negative integer.');
  }
  return { limit, offset };
}

function findingView(finding: AnalysisCache['findings'][number], states: FindingWorkflowStates) {
  const raw = finding as unknown as Record<string, unknown>;
  return {
    id: finding.id,
    ruleId: String(raw['rule_id'] ?? 'UNKNOWN'),
    title: finding.title,
    severity: finding.severity,
    category: finding.category,
    analyzerId: finding.analyzer_id,
    description: String(raw['description'] ?? raw['message'] ?? ''),
    status: states[finding.id]?.status ?? 'open',
    assignee: states[finding.id]?.assignee ?? '',
  };
}

function opportunityView(opportunity: AnalysisCache['opportunities'][number]) {
  const raw = opportunity as unknown as Record<string, unknown>;
  const expectedImpact = raw['expected_impact'] as Record<string, unknown> | undefined;
  const effort = raw['effort'];
  return {
    id: opportunity.id,
    title: opportunity.title,
    severity: opportunity.severity,
    status: String(raw['status'] ?? 'open'),
    confidence: typeof raw['confidence'] === 'number' ? raw['confidence'] : 0,
    impact: typeof expectedImpact?.['summary'] === 'string' ? expectedImpact['summary'] : '',
    effort: typeof effort === 'string' ? effort : String((effort as Record<string, unknown> | undefined)?.['t_shirt'] ?? 'unknown'),
    category: String(raw['category'] ?? 'general'),
    description: String(raw['description'] ?? raw['problem'] ?? ''),
  };
}

function buildRoot(project: ScopedProject, cache: AnalysisCache | null, states: FindingWorkflowStates) {
  const health = calculateHealthScore(cache);
  const projectView = {
    id: project.id,
    name: project.name,
    slug: project.slug,
    repository: project.repository,
    language: project.language,
    healthScore: health.overall,
    analyzedAt: cache?.analyzedAt ?? null,
  };
  const findings = (cache?.findings ?? []).map((finding) => findingView(finding, states));
  const opportunities = (cache?.opportunities ?? []).map(opportunityView);

  return {
    project: () => projectView,
    finding: ({ id }: { id: string }) => findings.find((finding) => finding.id === id) ?? null,
    findings: (args: PaginationArgs & { severity?: string; analyzerId?: string; category?: string; status?: string }) => {
      const { limit, offset } = pagination(args);
      const filtered = findings.filter((finding) =>
        (!args.severity || finding.severity === args.severity) &&
        (!args.analyzerId || finding.analyzerId === args.analyzerId) &&
        (!args.category || finding.category === args.category) &&
        (!args.status || finding.status === args.status),
      );
      return { nodes: filtered.slice(offset, offset + limit), total: filtered.length, limit, offset };
    },
    analyzers: () => project.settings.analyzers.map((id) => ({
      id,
      name: id.split('.').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
      version: VERSION,
      ruleCount: null,
    })),
    collectors: () => project.settings.collectors.map((id) => ({
      id,
      ...(COLLECTOR_CATALOG[id] ?? { name: id, type: 'unknown' }),
      version: VERSION,
    })),
    healthScore: () => ({
      overall: health.overall,
      dimensions: health.dimensions.map((dimension) => ({ name: dimension.dimension, score: dimension.score })),
      findingCount: cache?.findings.length ?? 0,
      opportunityCount: cache?.opportunities.length ?? 0,
    }),
    opportunity: ({ id }: { id: string }) => opportunities.find((opportunity) => opportunity.id === id) ?? null,
    opportunities: (args: PaginationArgs & { severity?: string; status?: string }) => {
      const { limit, offset } = pagination(args);
      const filtered = opportunities.filter((opportunity) =>
        (!args.severity || opportunity.severity === args.severity) &&
        (!args.status || opportunity.status === args.status),
      );
      return { nodes: filtered.slice(offset, offset + limit), total: filtered.length, limit, offset };
    },
  };
}

const MAX_QUERY_BYTES = 50_000;
const MAX_QUERY_DEPTH = 12;
const MAX_SELECTED_FIELDS = 500;

function enforceQueryLimits(document: DocumentNode): void {
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) fragments.set(definition.name.value, definition);
  }
  let fieldCount = 0;
  let maxDepth = 0;
  const walk = (selectionSet: SelectionSetNode, depth: number, fragmentPath: Set<string>) => {
    maxDepth = Math.max(maxDepth, depth);
    for (const selection of selectionSet.selections) {
      if (selection.kind === Kind.FIELD) {
        fieldCount += 1;
        if (selection.selectionSet) walk(selection.selectionSet, depth + 1, fragmentPath);
      } else if (selection.kind === Kind.INLINE_FRAGMENT) {
        walk(selection.selectionSet, depth, fragmentPath);
      } else {
        const name = selection.name.value;
        if (fragmentPath.has(name)) continue;
        const fragment = fragments.get(name);
        if (fragment) walk(fragment.selectionSet, depth, new Set([...fragmentPath, name]));
      }
    }
  };
  for (const definition of document.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) walk(definition.selectionSet, 1, new Set());
  }
  if (maxDepth > MAX_QUERY_DEPTH) throw new GraphQLError(`Query depth exceeds the maximum of ${MAX_QUERY_DEPTH}.`);
  if (fieldCount > MAX_SELECTED_FIELDS) throw new GraphQLError(`Query selects more than ${MAX_SELECTED_FIELDS} fields.`);
}

function formattedErrors(errors: readonly GraphQLError[]) {
  return errors.map((error) => error.toJSON());
}

export async function registerGraphQLRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: GraphQLRequestBody; Querystring: { projectId?: string } }>(
    '/api/v1/graphql',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const body = request.body;
      if (!body || typeof body.query !== 'string' || !body.query.trim()) {
        return reply.status(400).send({ data: null, errors: [{ message: 'Request body must include a non-empty query string.' }] });
      }
      if (Buffer.byteLength(body.query, 'utf8') > MAX_QUERY_BYTES) {
        return reply.status(413).send({ data: null, errors: [{ message: `Query exceeds ${MAX_QUERY_BYTES} bytes.` }] });
      }

      let document: DocumentNode;
      try {
        document = parse(body.query);
        enforceQueryLimits(document);
      } catch (error) {
        const graphError = error instanceof GraphQLError ? error : new GraphQLError('Unable to parse GraphQL query.');
        return reply.status(400).send({ data: null, errors: formattedErrors([graphError]) });
      }
      const validationErrors = validate(schema, document, specifiedRules);
      if (validationErrors.length) {
        return reply.status(400).send({ data: null, errors: formattedErrors(validationErrors) });
      }

      const project = await requireProjectScope(request);
      const [cache, states] = await Promise.all([
        store.get<AnalysisCache>('analysis_cache', project.id),
        store.get<FindingWorkflowStates>('finding_states', project.id),
      ]);
      const startedAt = performance.now();
      const result = await execute({
        schema,
        document,
        rootValue: buildRoot(project, cache, states ?? {}),
        variableValues: body.variables ?? undefined,
        operationName: body.operationName ?? undefined,
      });
      logger.info('GraphQL query executed', {
        operationName: body.operationName ?? 'anonymous',
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      });
      return reply.status(200).send(result);
    },
  );

  app.get('/api/v1/graphql/schema', { preHandler: [authMiddleware] }, async (_request, reply) =>
    reply.header('content-type', 'text/plain; charset=utf-8').send(printSchema(schema)),
  );

  app.get('/api/v1/graphql/introspection', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const result = await graphql({ schema, source: getIntrospectionQuery() });
    return reply.send(result);
  });
}
