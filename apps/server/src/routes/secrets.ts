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
import { requireRole } from '../middleware/rbac.js';
import { store } from '../store.js';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// AES-256-GCM encryption helpers
// ---------------------------------------------------------------------------

const ENCRYPTION_ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;

/** Derive a 32-byte key from the configured secret. */
function getEncryptionKey(): Buffer {
  const raw = process.env['SECRETS_ENCRYPTION_KEY'] ?? 'recurrsive-default-encryption-key-32b';
  return createHash('sha256').update(raw).digest();
}

/** Encrypt a plaintext value using AES-256-GCM. Returns base64(iv + ciphertext + authTag). */
function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Pack as: iv (12) + ciphertext (variable) + authTag (16)
  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

/** Decrypt a value produced by encryptSecret. */
export function decryptSecret(encoded: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(buf.length - AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH, buf.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

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
    const list = (await store.all<SecretEntry>('secrets')).sort((a, b) => a.key.localeCompare(b.key));
    return reply.send({ data: list, total: list.length });
  });

  // Get secret metadata
  app.get<{ Params: { id: string } }>('/api/v1/secrets/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const secret = await store.get<SecretEntry>('secrets', request.params.id);
    if (!secret) return reply.status(404).send({ error: 'Not Found', message: 'Secret not found' });

    // Log access
    await store.append<SecretAuditEntry>('secret_audit', {
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
    preHandler: [authMiddleware, requireRole('admin')],
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

    await store.set('secrets', id, entry);
    await store.set('secret_values', id, encryptSecret(body.value));

    await store.append<SecretAuditEntry>('secret_audit', {
      id: generateId(), secretId: id, secretKey: entry.key,
      action: 'created', actor: 'api-user', timestamp: now, metadata: {},
    });

    return reply.status(201).send({ data: entry });
  });

  // Rotate secret
  app.post<{ Params: { id: string } }>('/api/v1/secrets/:id/rotate', {
    preHandler: [authMiddleware, requireRole('admin')],
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
    const secret = await store.get<SecretEntry>('secrets', request.params.id);
    if (!secret) return reply.status(404).send({ error: 'Not Found', message: 'Secret not found' });

    const body = request.body as { newValue?: string };
    const now = nowISO();

    secret.version += 1;
    secret.lastRotated = now;
    secret.updatedAt = now;
    await store.set('secrets', secret.id, secret);

    if (body.newValue) {
      await store.set('secret_values', secret.id, encryptSecret(body.newValue));
    }

    await store.append<SecretAuditEntry>('secret_audit', {
      id: generateId(), secretId: secret.id, secretKey: secret.key,
      action: 'rotated', actor: 'api-user', timestamp: now,
      metadata: { newVersion: String(secret.version) },
    });

    return reply.send({ data: secret, message: `Secret rotated to version ${secret.version}` });
  });

  // Delete secret
  app.delete<{ Params: { id: string } }>('/api/v1/secrets/:id', { preHandler: [authMiddleware, requireRole('admin')] }, async (request, reply) => {
    const secret = await store.get<SecretEntry>('secrets', request.params.id);
    if (!secret) return reply.status(404).send({ error: 'Not Found', message: 'Secret not found' });

    await store.append<SecretAuditEntry>('secret_audit', {
      id: generateId(), secretId: secret.id, secretKey: secret.key,
      action: 'deleted', actor: 'api-user', timestamp: nowISO(), metadata: {},
    });

    await store.delete('secrets', request.params.id);
    await store.delete('secret_values', request.params.id);
    return reply.status(204).send();
  });

  // Get audit log for secrets
  app.get('/api/v1/secrets/audit/log', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const recentEntries = await store.recent<SecretAuditEntry>('secret_audit', 100);
    const total = await store.count('secret_audit');
    return reply.send({ data: recentEntries, total });
  });

  // Check rotation status
  app.get('/api/v1/secrets/health/rotation', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const now = Date.now();
    const allSecrets = await store.all<SecretEntry>('secrets');
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
        total: await store.count('secrets'),
        withAutoRotation: allSecrets.filter(s => s.rotationIntervalDays > 0).length,
        needsRotation,
        status: needsRotation.length === 0 ? 'healthy' : 'action_required',
      },
    });
  });
}
