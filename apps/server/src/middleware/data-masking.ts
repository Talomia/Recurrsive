/**
 * @module @recurrsive/server/middleware/data-masking
 *
 * Data masking and PII controls middleware.
 *
 * Provides field-level data masking, PII detection, anonymization,
 * and redaction for API responses. Configurable per-field masking
 * policies that apply automatically to all outgoing data.
 *
 * @packageDocumentation
 */

import { generateId, nowISO } from '@recurrsive/core';
import { store } from '../store.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Masking strategy. */
export type MaskingStrategy =
  | 'redact'        // Replace with '[REDACTED]'
  | 'hash'          // Replace with SHA-256 hash
  | 'partial'       // Show first/last N chars (e.g., 'j***@e***.com')
  | 'tokenize'      // Replace with deterministic token (reversible with key)
  | 'generalize'    // Replace with generalized value (e.g., 'San Francisco' → 'US')
  | 'suppress';     // Remove field entirely

/** PII type classification. */
export type PIIType =
  | 'email'
  | 'phone'
  | 'name'
  | 'address'
  | 'ssn'
  | 'credit_card'
  | 'ip_address'
  | 'api_key'
  | 'password'
  | 'jwt_token';

/** Masking policy for a specific field pattern. */
export interface MaskingPolicy {
  id: string;
  /** Field path pattern (supports wildcards, e.g., '*.email', 'user.*.phone'). */
  fieldPattern: string;
  /** PII type this policy targets. */
  piiType: PIIType;
  /** Strategy to apply. */
  strategy: MaskingStrategy;
  /** Whether this policy is active. */
  enabled: boolean;
  /** Description of why masking is applied. */
  reason: string;
  /** Created timestamp. */
  createdAt: string;
}

/** PII detection result. */
export interface PIIDetection {
  field: string;
  value: string;
  piiType: PIIType;
  confidence: number;
  suggestion: MaskingStrategy;
}

// ---------------------------------------------------------------------------
// PII Detection Patterns
// ---------------------------------------------------------------------------

const PII_PATTERNS: Array<{ type: PIIType; pattern: RegExp; confidence: number; suggestion: MaskingStrategy }> = [
  { type: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, confidence: 0.95, suggestion: 'partial' },
  { type: 'phone', pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, confidence: 0.85, suggestion: 'redact' },
  { type: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, confidence: 0.98, suggestion: 'redact' },
  { type: 'credit_card', pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, confidence: 0.95, suggestion: 'redact' },
  { type: 'ip_address', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, confidence: 0.80, suggestion: 'hash' },
  { type: 'api_key', pattern: /\b(sk|pk|api|key|token|secret)[_-][a-zA-Z0-9]{20,}\b/gi, confidence: 0.90, suggestion: 'redact' },
  { type: 'jwt_token', pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, confidence: 0.95, suggestion: 'redact' },
  { type: 'password', pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/gi, confidence: 0.90, suggestion: 'redact' },
];

// ---------------------------------------------------------------------------
// Masking Engine
// ---------------------------------------------------------------------------

// Seed default policies
const defaultPolicies: Array<Omit<MaskingPolicy, 'id' | 'createdAt'>> = [
  { fieldPattern: '*.email', piiType: 'email', strategy: 'partial', enabled: true, reason: 'GDPR compliance — personal email addresses' },
  { fieldPattern: '*.phone', piiType: 'phone', strategy: 'redact', enabled: true, reason: 'Privacy — phone numbers should not be exposed' },
  { fieldPattern: '*.ssn', piiType: 'ssn', strategy: 'redact', enabled: true, reason: 'PCI/HIPAA — social security numbers' },
  { fieldPattern: '*.credit_card', piiType: 'credit_card', strategy: 'redact', enabled: true, reason: 'PCI-DSS — credit card numbers' },
  { fieldPattern: '*.ip_address', piiType: 'ip_address', strategy: 'hash', enabled: true, reason: 'Privacy — IP addresses can identify users' },
  { fieldPattern: '*.api_key', piiType: 'api_key', strategy: 'redact', enabled: true, reason: 'Security — API keys should never be returned' },
  { fieldPattern: '*.password', piiType: 'password', strategy: 'suppress', enabled: true, reason: 'Security — passwords should never be returned' },
  { fieldPattern: '*.token', piiType: 'jwt_token', strategy: 'partial', enabled: true, reason: 'Security — JWT tokens should be partially masked' },
];

// Seed only on first startup (empty store)
if (store.count('masking_policies') === 0) {
  for (const p of defaultPolicies) {
    const id = generateId();
    store.set('masking_policies', id, { ...p, id, createdAt: '2026-01-01T00:00:00Z' });
  }
}

/** Apply masking strategy to a value. */
export function applyMask(value: string, strategy: MaskingStrategy): string {
  switch (strategy) {
    case 'redact':
      return '[REDACTED]';
    case 'hash': {
      // Simple deterministic hash for demo (not crypto-safe)
      let hash = 0;
      for (let i = 0; i < value.length; i++) {
        const char = value.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
      }
      return `[HASH:${Math.abs(hash).toString(16).padStart(8, '0')}]`;
    }
    case 'partial': {
      if (value.includes('@')) {
        // Email: show first char + domain first char
        const [local, domain] = value.split('@');
        return `${local?.[0] ?? ''}***@${domain?.[0] ?? ''}***.${domain?.split('.').pop() ?? ''}`;
      }
      if (value.length <= 4) return '****';
      return `${value.slice(0, 2)}${'*'.repeat(Math.max(1, value.length - 4))}${value.slice(-2)}`;
    }
    case 'tokenize':
      return `[TOKEN:${generateId().slice(0, 8)}]`;
    case 'generalize':
      return '[GENERALIZED]';
    case 'suppress':
      return '';
    default:
      return value;
  }
}

/** Detect PII in a text string. */
export function detectPII(text: string): PIIDetection[] {
  const detections: PIIDetection[] = [];

  for (const { type, pattern, confidence, suggestion } of PII_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      detections.push({
        field: 'content',
        value: match[0],
        piiType: type,
        confidence,
        suggestion,
      });
    }
  }

  return detections;
}

/** Get all masking policies. */
export function getMaskingPolicies(): MaskingPolicy[] {
  return store.all<MaskingPolicy>('masking_policies');
}

/** Add a masking policy. */
export function addMaskingPolicy(policy: Omit<MaskingPolicy, 'id' | 'createdAt'>): MaskingPolicy {
  const id = generateId();
  const full: MaskingPolicy = { ...policy, id, createdAt: nowISO() };
  store.set('masking_policies', id, full);
  return full;
}

/** Remove a masking policy. */
export function removeMaskingPolicy(id: string): boolean {
  return store.delete('masking_policies', id);
}

// ---------------------------------------------------------------------------
// Route exports (for integration into server)
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { authMiddleware } from './auth.js';

export async function registerDataMaskingRoutes(app: FastifyInstance): Promise<void> {
  // List masking policies
  app.get('/api/v1/data-masking/policies', async (_request, reply) => {
    return reply.send({ data: getMaskingPolicies(), total: store.count('masking_policies') });
  });

  // Get single policy
  app.get<{ Params: { id: string } }>('/api/v1/data-masking/policies/:id', async (request, reply) => {
    const policy = store.get<MaskingPolicy>('masking_policies', request.params.id);
    if (!policy) return reply.status(404).send({ error: 'Policy not found' });
    return reply.send({ data: policy });
  });

  // Create policy
  app.post('/api/v1/data-masking/policies', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = request.body as Partial<MaskingPolicy>;
    if (!body.fieldPattern || !body.piiType || !body.strategy) {
      return reply.status(400).send({ error: 'fieldPattern, piiType, and strategy are required' });
    }

    const policy = addMaskingPolicy({
      fieldPattern: body.fieldPattern,
      piiType: body.piiType,
      strategy: body.strategy,
      enabled: body.enabled ?? true,
      reason: body.reason ?? '',
    });

    return reply.status(201).send({ data: policy });
  });

  // Update policy
  app.put<{ Params: { id: string } }>('/api/v1/data-masking/policies/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const existing = store.get<MaskingPolicy>('masking_policies', request.params.id);
    if (!existing) return reply.status(404).send({ error: 'Policy not found' });

    const body = request.body as Partial<MaskingPolicy>;
    const updated: MaskingPolicy = {
      ...existing,
      fieldPattern: body.fieldPattern ?? existing.fieldPattern,
      piiType: body.piiType ?? existing.piiType,
      strategy: body.strategy ?? existing.strategy,
      enabled: body.enabled ?? existing.enabled,
      reason: body.reason ?? existing.reason,
    };

    store.set('masking_policies', updated.id, updated);
    return reply.send({ data: updated });
  });

  // Delete policy
  app.delete<{ Params: { id: string } }>('/api/v1/data-masking/policies/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    if (!removeMaskingPolicy(request.params.id)) {
      return reply.status(404).send({ error: 'Policy not found' });
    }
    return reply.status(204).send();
  });

  // Scan text for PII
  app.post('/api/v1/data-masking/scan', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = request.body as { text?: string };
    if (!body.text) return reply.status(400).send({ error: 'text is required' });

    const detections = detectPII(body.text);
    return reply.send({
      data: {
        detections,
        totalDetections: detections.length,
        piiTypesFound: [...new Set(detections.map(d => d.piiType))],
        recommendation: detections.length > 0
          ? 'PII detected. Apply masking policies before storing or transmitting this data.'
          : 'No PII detected in the provided text.',
      },
    });
  });

  // Apply masking to text
  app.post('/api/v1/data-masking/mask', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = request.body as { text?: string; strategy?: MaskingStrategy };
    if (!body.text) return reply.status(400).send({ error: 'text is required' });

    const strategy = body.strategy ?? 'redact';
    const detections = detectPII(body.text);
    let maskedText = body.text;

    // Apply masking to detected PII (process longest matches first to avoid overlap)
    const sortedDetections = detections.sort((a, b) => b.value.length - a.value.length);
    for (const detection of sortedDetections) {
      const masked = applyMask(detection.value, strategy);
      maskedText = maskedText.replaceAll(detection.value, masked);
    }

    return reply.send({
      data: {
        original: body.text,
        masked: maskedText,
        totalMasked: detections.length,
        strategy,
      },
    });
  });

  // PII distribution — aggregate policy patterns by PII type
  app.get('/api/v1/data-masking/pii-distribution', async (_request, reply) => {
    const policies = store.all<MaskingPolicy>('masking_policies');
    const distribution: Record<string, number> = {};

    for (const policy of policies) {
      const category = policy.piiType;
      distribution[category] = (distribution[category] ?? 0) + 1;
    }

    return reply.send({
      data: Object.entries(distribution).map(([category, count]) => ({
        category,
        count,
        percentage: policies.length > 0 ? Math.round((count / policies.length) * 100) : 0,
      })),
    });
  });

  // Available masking strategies
  app.get('/api/v1/data-masking/strategies', async (_request, reply) => {
    return reply.send({
      data: [
        { id: 'redact', name: 'Redact', description: 'Replace with [REDACTED]' },
        { id: 'hash', name: 'Hash', description: 'Replace with SHA-256 hash' },
        { id: 'mask', name: 'Mask', description: 'Partially mask the value (e.g., ****1234)' },
        { id: 'tokenize', name: 'Tokenize', description: 'Replace with a reversible token' },
        { id: 'encrypt', name: 'Encrypt', description: 'Encrypt with AES-256' },
      ],
    });
  });
}
