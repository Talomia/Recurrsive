import type { FastifyInstance, FastifySchema } from 'fastify';

export interface RegisteredRoute {
  method: string;
  url: string;
  schema?: FastifySchema;
}

const inventories = new WeakMap<FastifyInstance, RegisteredRoute[]>();

export function registerRouteInventory(app: FastifyInstance): void {
  const routes: RegisteredRoute[] = [];
  inventories.set(app, routes);
  app.addHook('onRoute', (options) => {
    const methods = Array.isArray(options.method) ? options.method : [options.method];
    for (const method of methods) {
      routes.push({
        method: String(method).toUpperCase(),
        url: options.url,
        ...(options.schema ? { schema: options.schema } : {}),
      });
    }
  });
}

export function getRouteInventory(app: FastifyInstance): RegisteredRoute[] {
  return [...(inventories.get(app) ?? [])];
}
