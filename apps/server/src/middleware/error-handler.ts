/**
 * @module @recurrsive/server/middleware/error-handler
 *
 * Global error handler for the Recurrsive API server.
 *
 * Provides consistent JSON error responses, request ID tracking,
 * and safe error serialisation (no internal details leaked in production).
 *
 * @packageDocumentation
 */

import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger } from '@recurrsive/core';

const logger = createLogger({ context: { component: 'server:error-handler' } });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Standard error response body. */
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  requestId?: string;
}

// ---------------------------------------------------------------------------
// Error Handler
// ---------------------------------------------------------------------------

/**
 * Register a global error handler on the Fastify instance.
 *
 * - Maps known Fastify validation errors to 400
 * - Maps known application errors to appropriate status codes
 * - Catches unexpected errors with 500
 * - Logs all errors for debugging
 * - Never leaks stack traces or internal details
 *
 * @param app - The Fastify instance.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      const requestId = request.id;

      // Determine status code
      let statusCode = error.statusCode ?? 500;
      let errorType = 'Internal Server Error';
      let message = 'An unexpected error occurred';

      if (statusCode >= 400 && statusCode < 500) {
        // Client errors — safe to expose message
        errorType = statusCodeName(statusCode);
        message = error.message;
      } else if (error.validation) {
        // Fastify schema validation error
        statusCode = 400;
        errorType = 'Validation Error';
        message = error.message;
      } else if (error.code === 'FST_ERR_NOT_FOUND') {
        statusCode = 404;
        errorType = 'Not Found';
        message = 'The requested resource was not found';
      } else {
        // 5xx — log full error but don't expose details
        logger.error('Unhandled server error', {
          requestId,
          method: request.method,
          url: request.url,
          error: error.message,
          stack: error.stack,
        });
      }

      const response: ErrorResponse = {
        error: errorType,
        message,
        statusCode,
        requestId,
      };

      reply.status(statusCode).send(response);
    },
  );

  // 404 handler for unmatched routes
  app.setNotFoundHandler((_request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
      statusCode: 404,
    });
  });
}

/**
 * Map a status code to its standard name.
 */
function statusCodeName(code: number): string {
  const names: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    409: 'Conflict',
    413: 'Payload Too Large',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
  };
  return names[code] ?? 'Client Error';
}
