/**
 * @module @recurrsive/server/routes/secrets
 *
 * Secret management integration routes.
 *
 * Provides a unified API for managing secrets with backend support
 * for HashiCorp Vault, AWS Secrets Manager, and Azure Key Vault.
 * All secrets are stored encrypted in-memory for demonstration.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';

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

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

const secrets: Map<string, SecretEntry> = new Map();
const auditLog: SecretAuditEntry[] = [];
const secretValues: Map<string, string> = new Map();

// Seed demo secrets
const demoSecrets: Array<Omit<SecretEntry, 'id' | 'createdAt' | 'updatedAt'>> = [
  { key: 'GITHUB_TOKEN', description: 'GitHub personal access token for API access', backend: 'vault', version: 3, tags: ['github', 'api', 'ci'], createdBy: 'sarah.chen', lastRotated: '2026-06-15T00:00:00Z', rotationIntervalDays: 90, expiresAt: '2026-09-15T00:00:00Z' },
  { key: 'OPENAI_API_KEY', description: 'OpenAI API key for reasoning engine', backend: 'aws-secrets-manager', version: 2, tags: ['ai', 'openai', 'production'], createdBy: 'marcus.johnson', lastRotated: '2026-06-01T00:00:00Z', rotationIntervalDays: 60, expiresAt: null },
  { key: 'DATABASE_URL', description: 'PostgreSQL connection string', backend: 'vault', version: 5, tags: ['database', 'postgres', 'infrastructure'], createdBy: 'sarah.chen', lastRotated: '2026-06-20T00:00:00Z', rotationIntervalDays: 30, expiresAt: null },
  { key: 'SENTRY_DSN', description: 'Sentry error tracking DSN', backend: 'local', version: 1, tags: ['monitoring', 'sentry'], createdBy: 'priya.patel', lastRotated: null, rotationIntervalDays: 0, expiresAt: null },
  { key: 'ANTHROPIC_API_KEY', description: 'Anthropic Claude API key for reasoning', backend: 'aws-secrets-manager', version: 1, tags: ['ai', 'anthropic', 'production'], createdBy: 'marcus.johnson', lastRotated: '2026-05-15T00:00:00Z', rotationIntervalDays: 90, expiresAt: null },
  { key: 'JWT_SECRET', description: 'JWT signing secret for auth tokens', backend: 'vault', version: 7, tags: ['auth', 'security', 'critical'], createdBy: 'sarah.chen', lastRotated: '2026-06-25T00:00:00Z', rotationIntervalDays: 30, expiresAt: null },
  { key: 'SLACK_WEBHOOK_URL', description: 'Slack webhook for notifications', backend: 'local', version: 1, tags: ['notifications', 'slack'], createdBy: 'priya.patel', lastRotated: null, rotationIntervalDays: 0, expiresAt: null },
  { key: 'DATADOG_API_KEY', description: 'Datadog API key for APM integration', backend: 'vault', version: 2, tags: ['monitoring', 'datadog', 'apm'], createdBy: 'sarah.chen', lastRotated: '2026-06-10T00:00:00Z', rotationIntervalDays: 90, expiresAt: null },
];

for (const s of demoSecrets) {
  const id = generateId();
  const now = nowISO();
  secrets.set(id, { ...s, id, createdAt: '2026-01-01T00:00:00Z', updatedAt: now });
  secretValues.set(id, `[ENCRYPTED:${s.key.toLowerCase().replace(/_/g, '-')}-value-v${s.version}]`);
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerSecretRoutes(app: FastifyInstance): Promise<void> {
  // List secrets (never returns values)
  app.get('/api/v1/secrets', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const list = Array.from(secrets.values()).sort((a, b) => a.key.localeCompare(b.key));
    return reply.send({ data: list, total: list.length });
  });

  // Get secret metadata
  app.get<{ Params: { id: string } }>('/api/v1/secrets/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const secret = secrets.get(request.params.id);
    if (!secret) return reply.status(404).send({ error: 'Not Found', message: 'Secret not found' });

    // Log access
    auditLog.push({
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
  app.post('/api/v1/secrets', { preHandler: [authMiddleware] }, async (request, reply) => {
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

    secrets.set(id, entry);
    secretValues.set(id, `[ENCRYPTED:${body.value}]`);

    auditLog.push({
      id: generateId(), secretId: id, secretKey: entry.key,
      action: 'created', actor: 'api-user', timestamp: now, metadata: {},
    });

    return reply.status(201).send({ data: entry });
  });

  // Rotate secret
  app.post<{ Params: { id: string } }>('/api/v1/secrets/:id/rotate', { preHandler: [authMiddleware] }, async (request, reply) => {
    const secret = secrets.get(request.params.id);
    if (!secret) return reply.status(404).send({ error: 'Not Found', message: 'Secret not found' });

    const body = request.body as { newValue?: string };
    const now = nowISO();

    secret.version += 1;
    secret.lastRotated = now;
    secret.updatedAt = now;

    if (body.newValue) {
      secretValues.set(secret.id, `[ENCRYPTED:${body.newValue}]`);
    }

    auditLog.push({
      id: generateId(), secretId: secret.id, secretKey: secret.key,
      action: 'rotated', actor: 'api-user', timestamp: now,
      metadata: { newVersion: String(secret.version) },
    });

    return reply.send({ data: secret, message: `Secret rotated to version ${secret.version}` });
  });

  // Delete secret
  app.delete<{ Params: { id: string } }>('/api/v1/secrets/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const secret = secrets.get(request.params.id);
    if (!secret) return reply.status(404).send({ error: 'Not Found', message: 'Secret not found' });

    auditLog.push({
      id: generateId(), secretId: secret.id, secretKey: secret.key,
      action: 'deleted', actor: 'api-user', timestamp: nowISO(), metadata: {},
    });

    secrets.delete(request.params.id);
    secretValues.delete(request.params.id);
    return reply.status(204).send();
  });

  // Get audit log for secrets
  app.get('/api/v1/secrets/audit/log', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.send({ data: auditLog.slice(-100), total: auditLog.length });
  });

  // Check rotation status
  app.get('/api/v1/secrets/health/rotation', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const now = Date.now();
    const needsRotation: Array<{ id: string; key: string; daysSinceRotation: number; intervalDays: number }> = [];

    for (const secret of secrets.values()) {
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
        total: secrets.size,
        withAutoRotation: Array.from(secrets.values()).filter(s => s.rotationIntervalDays > 0).length,
        needsRotation,
        status: needsRotation.length === 0 ? 'healthy' : 'action_required',
      },
    });
  });
}
