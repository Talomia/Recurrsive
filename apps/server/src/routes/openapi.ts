import type { FastifyInstance, FastifySchema } from 'fastify';
import { createRequire } from 'node:module';
import { isPublicRoute } from '../middleware/auth.js';
import { getRouteInventory } from '../route-inventory.js';

const require = createRequire(import.meta.url);
const PKG_VERSION = (require('../../package.json') as { version: string }).version;

type JsonSchema = Record<string, unknown>;

function normalizePath(url: string): string {
  return url.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function tagFor(url: string): string {
  const segment = url.split('/').filter(Boolean)[2] ?? url.split('/').filter(Boolean)[0] ?? 'General';
  return segment.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function operationId(method: string, url: string): string {
  const suffix = url
    .replace(/^\/api\/v1\/?/, '')
    .replace(/^\//, '')
    .replace(/:([A-Za-z0-9_]+)/g, ' by $1')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return `${method.toLowerCase()}${suffix || 'Root'}`;
}

function parametersFor(url: string, schema?: FastifySchema): JsonSchema[] {
  const parameters: JsonSchema[] = [];
  const paramsSchema = schema?.params as JsonSchema | undefined;
  const properties = (paramsSchema?.['properties'] as Record<string, JsonSchema> | undefined) ?? {};
  for (const name of [...url.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1]!)) {
    parameters.push({ name, in: 'path', required: true, schema: properties[name] ?? { type: 'string' } });
  }

  const querySchema = schema?.querystring as JsonSchema | undefined;
  const queryProperties = (querySchema?.['properties'] as Record<string, JsonSchema> | undefined) ?? {};
  const required = new Set((querySchema?.['required'] as string[] | undefined) ?? []);
  for (const [name, propertySchema] of Object.entries(queryProperties)) {
    parameters.push({ name, in: 'query', required: required.has(name), schema: propertySchema });
  }
  return parameters;
}

function buildSpec(app: FastifyInstance) {
  const paths: Record<string, Record<string, unknown>> = {};
  const routes = getRouteInventory(app)
    .filter((route) => !['HEAD', 'OPTIONS'].includes(route.method));

  for (const route of routes) {
    const path = normalizePath(route.url);
    const method = route.method.toLowerCase();
    const schema = route.schema;
    const documentedSchema = schema as (FastifySchema & { summary?: string; description?: string }) | undefined;
    const parameters = parametersFor(route.url, schema);
    const responseSchemas = (schema?.response ?? {}) as Record<string, unknown>;
    const responses = Object.keys(responseSchemas).length
      ? Object.fromEntries(Object.entries(responseSchemas).map(([status, responseSchema]) => [status, {
          description: `HTTP ${status} response`,
          content: { 'application/json': { schema: responseSchema } },
        }]))
      : { '2XX': { description: 'Successful response' } };

    const operation: Record<string, unknown> = {
      tags: [tagFor(route.url)],
      summary: documentedSchema?.summary ?? `${route.method} ${route.url}`,
      operationId: operationId(route.method, route.url),
      responses,
      security: isPublicRoute(route.method, route.url) ? [] : [{ bearerAuth: [] }, { apiKey: [] }],
    };
    if (documentedSchema?.description) operation['description'] = documentedSchema.description;
    if (parameters.length) operation['parameters'] = parameters;
    if (schema?.body) {
      operation['requestBody'] = {
        required: true,
        content: { 'application/json': { schema: schema.body } },
      };
    }
    paths[path] ??= {};
    paths[path]![method] = operation;
  }

  const tags = [...new Set(routes.map((route) => tagFor(route.url)))]
    .sort()
    .map((name) => ({ name }));

  return {
    openapi: '3.1.0',
    info: {
      title: 'Recurrsive API',
      version: PKG_VERSION,
      description: 'Runtime-generated specification for this self-hosted Recurrsive deployment.',
    },
    servers: [{ url: '/api/v1', description: 'Current deployment' }],
    tags,
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
    },
  };
}

export async function registerOpenAPIRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/openapi.json', async (_request, reply) => {
    return reply.header('Cache-Control', 'no-store').send(buildSpec(app));
  });

  app.get('/api/docs', async (_request, reply) => {
    return reply.redirect('/api/v1/openapi.json');
  });
}
