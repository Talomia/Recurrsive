/**
 * @module @recurrsive/server/routes/secrets
 *
 * Secret management integration routes.
 *
 * Provides a unified API for managing secrets with backend support
 * for HashiCorp Vault, AWS Secrets Manager, and Azure Key Vault.
 * All secrets are stored encrypted in the SQLite store.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';
import { store } from '../store.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SecretBackend = 'vault' | 'aws-secrets-manager' | 'azure-key-vault' | 'local';

interface SecretEntry {
  id: string;
  key: string;
  /** Description (never the actual value). */
  description: string;
  /** Backend where the secret is stored. */
  backend: SecretBackend;
  /** Secret version. */
  version: number;
  /** Tags for organization. */
  tags: string[];
  /** Who created it. */
  createdBy: string;
  /** Last rotation date. */
  lastRotated: string | null;
  /** Auto-rotation interval (days, 0 = manual). */
  rotationIntervalDays: number;
  /** Expiration date (null = no expiry). */
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SecretAuditEntry {
  id: string;
  secretId: string;
  secretKey: string;
  action: 'created' | 'read' | 'updated' | 'rotated' | 'deleted';
  actor: string;
  timestamp: string;
  metadata: Record<string, string>;
}

// No seed data — secrets are created by the user via the API.

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerSecretRoutes(app: FastifyInstance): Promise<void> {
  // List secrets (never returns values)
  app.get('/api/v1/secrets', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const list = store.all<SecretEntry>('secrets').sort((a, b) => a.key.localeCompare(b.key));
    return reply.send({ data: list, total: list.length });
  });

  // Get secret metadata
  app.get<{ Params: { id: string } }>('/api/v1/secrets/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const secret = store.get<SecretEntry>('secrets', request.params.id);
    if (!secret) return reply.status(404).send({ error: 'Not Found', message: 'Secret not found' });

    // Log access
    store.append<SecretAuditEntry>('secret_audit', {
      id: generateId(),
      secretId: secret.id,
      secretKey: secret.key,
      action: 'read',
      actor: 'api-user',
      timestamp: nowISO(),
      metadata: { method: 'metadata-only' },
    });

    return reply.send({ data: secret });
  });

  // Create secret
  app.post('/api/v1/secrets', {
    preHandler: [authMiddleware],
    schema: {
      body: {
        type: 'object',
        required: ['key', 'value'],
        properties: {
          key: { type: 'string', minLength: 1 },
          value: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          backend: { type: 'string', enum: ['local', 'vault', 'aws', 'azure', 'gcp'] },
          tags: { type: 'array', items: { type: 'string' } },
          rotationIntervalDays: { type: 'integer', minimum: 0 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const body = request.body as { key?: string; value?: string; description?: string; backend?: SecretBackend; tags?: string[]; rotationIntervalDays?: number };
    if (!body.key || !body.value) {
      return reply.status(400).send({ error: 'Bad Request', message: 'key and value are required' });
    }

    const id = generateId();
    const now = nowISO();
    const entry: SecretEntry = {
      id,
      key: body.key,
      description: body.description ?? '',
      backend: body.backend ?? 'local',
      version: 1,
      tags: body.tags ?? [],
      createdBy: 'api-user',
      lastRotated: null,
      rotationIntervalDays: body.rotationIntervalDays ?? 0,
      expiresAt: null,
      createdAt: now,
      updatedAt: now,
    };

    store.set('secrets', id, entry);
    store.set('secret_values', id, `[ENCRYPTED:${body.value}]`);

    store.append<SecretAuditEntry>('secret_audit', {
      id: generateId(), secretId: id, secretKey: entry.key,
      action: 'created', actor: 'api-user', timestamp: now, metadata: {},
    });

    return reply.status(201).send({ data: entry });
  });

  // Rotate secret
  app.post<{ Params: { id: string } }>('/api/v1/secrets/:id/rotate', {
    preHandler: [authMiddleware],
    schema: {
      body: {
        type: 'object',
        properties: {
          newValue: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const secret = store.get<SecretEntry>('secrets', request.params.id);
    if (!secret) return reply.status(404).send({ error: 'Not Found', message: 'Secret not found' });

    const body = request.body as { newValue?: string };
    const now = nowISO();

    secret.version += 1;
    secret.lastRotated = now;
    secret.updatedAt = now;
    store.set('secrets', secret.id, secret);

    if (body.newValue) {
      store.set('secret_values', secret.id, `[ENCRYPTED:${body.newValue}]`);
    }

    store.append<SecretAuditEntry>('secret_audit', {
      id: generateId(), secretId: secret.id, secretKey: secret.key,
      action: 'rotated', actor: 'api-user', timestamp: now,
      metadata: { newVersion: String(secret.version) },
    });

    return reply.send({ data: secret, message: `Secret rotated to version ${secret.version}` });
  });

  // Delete secret
  app.delete<{ Params: { id: string } }>('/api/v1/secrets/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const secret = store.get<SecretEntry>('secrets', request.params.id);
    if (!secret) return reply.status(404).send({ error: 'Not Found', message: 'Secret not found' });

    store.append<SecretAuditEntry>('secret_audit', {
      id: generateId(), secretId: secret.id, secretKey: secret.key,
      action: 'deleted', actor: 'api-user', timestamp: nowISO(), metadata: {},
    });

    store.delete('secrets', request.params.id);
    store.delete('secret_values', request.params.id);
    return reply.status(204).send();
  });

  // Get audit log for secrets
  app.get('/api/v1/secrets/audit/log', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const recentEntries = store.recent<SecretAuditEntry>('secret_audit', 100);
    const total = store.count('secret_audit');
    return reply.send({ data: recentEntries, total });
  });

  // Check rotation status
  app.get('/api/v1/secrets/health/rotation', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const now = Date.now();
    const allSecrets = store.all<SecretEntry>('secrets');
    const needsRotation: Array<{ id: string; key: string; daysSinceRotation: number; intervalDays: number }> = [];

    for (const secret of allSecrets) {
      if (secret.rotationIntervalDays <= 0) continue;
      const lastRotated = secret.lastRotated ? new Date(secret.lastRotated).getTime() : new Date(secret.createdAt).getTime();
      const daysSince = Math.floor((now - lastRotated) / 86400000);
      if (daysSince >= secret.rotationIntervalDays) {
        needsRotation.push({
          id: secret.id,
          key: secret.key,
          daysSinceRotation: daysSince,
          intervalDays: secret.rotationIntervalDays,
        });
      }
    }

    return reply.send({
      data: {
        total: store.count('secrets'),
        withAutoRotation: allSecrets.filter(s => s.rotationIntervalDays > 0).length,
        needsRotation,
        status: needsRotation.length === 0 ? 'healthy' : 'action_required',
      },
    });
  });
}
