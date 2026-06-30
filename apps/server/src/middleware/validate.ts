/**
 * @module @recurrsive/server/middleware/validate
 *
 * Request body validation middleware for the Recurrsive API server.
 *
 * Provides validation hooks for POST endpoints using simple type-checking.
 * No external dependencies required.
 *
 * @packageDocumentation
 */

import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A simple schema field definition. */
interface FieldSchema {
  /** The field name on the request body. */
  name: string;
  /** The expected type ('string', 'boolean', 'number', 'array', 'object'). */
  type: string;
  /** Whether the field is required (default: false). */
  required?: boolean;
  /** Minimum length for strings (default: none). */
  minLength?: number;
}

/** A validation error detail. */
interface ValidationIssue {
  field: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Schemas for POST endpoints
// ---------------------------------------------------------------------------

/** Schema for `POST /api/v1/analyze` request body. */
export const ANALYZE_REQUEST_FIELDS: FieldSchema[] = [
  { name: 'path', type: 'string', required: true, minLength: 1 },
  { name: 'analyzers', type: 'array', required: false },
  { name: 'include_reasoning', type: 'boolean', required: false },
  { name: 'config', type: 'object', required: false },
];

// ---------------------------------------------------------------------------
// Validation Hook Factory
// ---------------------------------------------------------------------------

/**
 * Create a Fastify preHandler hook that validates the request body
 * against the given field schemas.
 *
 * On validation failure, responds with a 400 status and structured
 * error details including field-level issues.
 *
 * @param fields - Array of field schemas to validate against.
 * @returns A Fastify preHandler hook function.
 *
 * @example
 * ```ts
 * app.post('/api/v1/analyze', {
 *   preHandler: validateBody(ANALYZE_REQUEST_FIELDS),
 * }, handler);
 * ```
 */
export function validateBody(fields: FieldSchema[]): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown> | null | undefined;

    if (!body || typeof body !== 'object') {
      reply.code(400).send({
        error: 'Validation Error',
        message: 'Request body must be a JSON object',
        statusCode: 400,
      });
      return;
    }

    const issues: ValidationIssue[] = [];

    for (const field of fields) {
      const value = body[field.name];

      // Required check
      if (field.required && (value === undefined || value === null)) {
        issues.push({
          field: field.name,
          message: `"${field.name}" is required`,
        });
        continue;
      }

      // Skip type check if value is absent and not required
      if (value === undefined || value === null) continue;

      // Type check
      if (field.type === 'array') {
        if (!Array.isArray(value)) {
          issues.push({
            field: field.name,
            message: `"${field.name}" must be an array`,
          });
        }
      } else if (typeof value !== field.type) {
        issues.push({
          field: field.name,
          message: `"${field.name}" must be of type ${field.type}`,
        });
      }

      // Min length for strings
      if (field.minLength && typeof value === 'string' && value.length < field.minLength) {
        issues.push({
          field: field.name,
          message: `"${field.name}" must be at least ${field.minLength} characters`,
        });
      }
    }

    if (issues.length > 0) {
      reply.code(400).send({
        error: 'Validation Error',
        message: 'Request body failed validation',
        statusCode: 400,
        issues,
      });
    }
  };
}
