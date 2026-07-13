/** Durable public contact submissions and authenticated administration. */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { store } from '../store.js';

type ContactStatus = 'new' | 'in_progress' | 'resolved' | 'spam';

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
  status: ContactStatus;
  submittedAt: string;
  updatedAt: string;
}

export async function registerContactRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/contact', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email', 'message'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 120 },
          email: { type: 'string', format: 'email', maxLength: 254 },
          company: { type: 'string', maxLength: 160 },
          subject: { type: 'string', maxLength: 120 },
          message: { type: 'string', minLength: 10, maxLength: 10_000 },
          // Honeypot field. Browsers leave it empty; commodity bots commonly
          // fill every input and receive a neutral success response.
          website: { type: 'string', maxLength: 0 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      name: string;
      email: string;
      company?: string;
      subject?: string;
      message: string;
      website?: string;
    };

    if (body.website) {
      return reply.status(202).send({ message: 'Submission accepted' });
    }

    const now = nowISO();
    const submission: ContactSubmission = {
      id: generateId(),
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      company: body.company?.trim() ?? '',
      subject: body.subject?.trim() ?? 'General Inquiry',
      message: body.message.trim(),
      status: 'new',
      submittedAt: now,
      updatedAt: now,
    };
    await store.set('contact_submissions', submission.id, submission);

    return reply.status(201).send({
      data: { id: submission.id, submittedAt: submission.submittedAt },
      message: 'Your message was received and stored securely.',
    });
  });

  app.get('/api/v1/contact', {
    preHandler: [authMiddleware, requireRole('admin')],
  }, async (_request, reply) => {
    const submissions = (await store.all<ContactSubmission>('contact_submissions'))
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return reply.send({ data: submissions, total: submissions.length });
  });

  app.patch<{ Params: { id: string }; Body: { status: ContactStatus } }>(
    '/api/v1/contact/:id',
    {
      preHandler: [authMiddleware, requireRole('admin')],
      schema: {
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['new', 'in_progress', 'resolved', 'spam'] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const submission = await store.get<ContactSubmission>('contact_submissions', request.params.id);
      if (!submission) return reply.status(404).send({ error: 'Not Found' });
      const updated = { ...submission, status: request.body.status, updatedAt: nowISO() };
      await store.set('contact_submissions', updated.id, updated);
      return reply.send({ data: updated });
    },
  );
}
