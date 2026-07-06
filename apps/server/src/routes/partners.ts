/**
 * @module @recurrsive/server/routes/partners
 *
 * Partner program routes for managing partner relationships,
 * certifications, and applications.
 *
 * Provides:
 * - Partner directory listing and detail
 * - Partner application submission
 * - Certification track management
 * - Partner statistics
 *
 * Data is persisted via ServerStore.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';
import { store } from '../store.js';
import { authMiddleware } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PartnerTier = 'platinum' | 'gold' | 'silver';
export type PartnerType = 'system-integrator' | 'consulting' | 'technology' | 'cloud-provider';
export type CertificationLevel = 'analyst' | 'architect' | 'administrator';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface Partner {
  id: string;
  name: string;
  tier: PartnerTier;
  type: PartnerType;
  description: string;
  specializations: string[];
  regions: string[];
  website: string;
  contactEmail: string;
  certifiedEngineers: number;
  customerCount: number;
  joinedAt: string;
  updatedAt: string;
}

export interface Certification {
  id: string;
  level: CertificationLevel;
  name: string;
  description: string;
  requirements: string[];
  examDuration: string;
  cost: number;
  passingScore: number;
  validityPeriod: string;
  enrolledCount: number;
  passRate: number;
}

export interface PartnerApplication {
  id: string;
  companyName: string;
  website: string;
  contactName: string;
  contactEmail: string;
  companySize: string;
  partnerType: PartnerType;
  description: string;
  status: ApplicationStatus;
  submittedAt: string;
  reviewedAt?: string;
}

// No seed data — partners and certifications are created by the user via the API.

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function registerPartnerRoutes(app: FastifyInstance): Promise<void> {
  const prefix = '/api/v1/partners';

  /**
   * GET /api/v1/partners
   *
   * List all partners with optional filtering.
   */
  app.get(prefix, { preHandler: [authMiddleware] }, async (request, reply) => {
    const query = request.query as { tier?: PartnerTier; type?: PartnerType; region?: string };

    let results = store.all<Partner>('partners');

    if (query.tier) {
      results = results.filter((p) => p.tier === query.tier);
    }
    if (query.type) {
      results = results.filter((p) => p.type === query.type);
    }
    if (query.region) {
      results = results.filter((p) => p.regions.some((r) => r.toLowerCase().includes(query.region!.toLowerCase())));
    }

    // Sort: platinum first, then gold, then silver
    const tierOrder: Record<PartnerTier, number> = { platinum: 0, gold: 1, silver: 2 };
    results.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);

    return reply.send({
      data: results,
      total: results.length,
      tierCounts: {
        platinum: results.filter((p) => p.tier === 'platinum').length,
        gold: results.filter((p) => p.tier === 'gold').length,
        silver: results.filter((p) => p.tier === 'silver').length,
      },
    });
  });

  /**
   * GET /api/v1/partners/:id
   *
   * Get partner detail.
   */
  app.get(`${prefix}/:id`, { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const partner = store.get<Partner>('partners', id);
    if (!partner) {
      return reply.status(404).send({ error: 'Not Found', message: 'Partner not found' });
    }
    return reply.send({ data: partner });
  });

  /**
   * POST /api/v1/partners/apply
   *
   * Submit a partner application.
   */
  app.post(`${prefix}/apply`, {
    preHandler: [authMiddleware],
    schema: {
      body: {
        type: 'object',
        required: ['companyName', 'contactEmail', 'partnerType'],
        properties: {
          companyName: { type: 'string', minLength: 1 },
          contactEmail: { type: 'string', format: 'email' },
          partnerType: { type: 'string', enum: ['technology', 'consulting', 'integration', 'reseller'] },
          description: { type: 'string' },
          website: { type: 'string' },
          contactName: { type: 'string' },
          companySize: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const body = request.body as Omit<PartnerApplication, 'id' | 'status' | 'submittedAt'>;

    if (!body.companyName || !body.contactEmail || !body.partnerType) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing required fields: companyName, contactEmail, partnerType',
      });
    }

    const id = generateId();
    const now = nowISO();

    const application: PartnerApplication = {
      id,
      companyName: body.companyName,
      website: body.website || '',
      contactName: body.contactName || '',
      contactEmail: body.contactEmail,
      companySize: body.companySize || '',
      partnerType: body.partnerType,
      description: body.description || '',
      status: 'pending',
      submittedAt: now,
    };

    store.set<PartnerApplication>('partner_applications', id, application);

    return reply.status(201).send({
      data: application,
      message: 'Application submitted successfully. Our team will review within 5 business days.',
    });
  });

  /**
   * GET /api/v1/partners/certifications
   *
   * List available certification tracks.
   */
  app.get(`${prefix}/certifications`, { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.send({
      data: store.all<Certification>('certifications'),
    });
  });

  /**
   * GET /api/v1/partners/stats
   *
   * Partner program statistics.
   */
  app.get(`${prefix}/stats`, { preHandler: [authMiddleware] }, async (_request, reply) => {
    const all = store.all<Partner>('partners');
    const totalEngineers = all.reduce((sum, p) => sum + p.certifiedEngineers, 0);
    const totalCustomers = all.reduce((sum, p) => sum + p.customerCount, 0);

    return reply.send({
      data: {
        totalPartners: all.length,
        totalCertifiedEngineers: totalEngineers,
        totalCustomersServed: totalCustomers,
        certificationTracks: store.count('certifications'),
        pendingApplications: store.all<PartnerApplication>('partner_applications').filter((a) => a.status === 'pending').length,
        tierDistribution: {
          platinum: all.filter((p) => p.tier === 'platinum').length,
          gold: all.filter((p) => p.tier === 'gold').length,
          silver: all.filter((p) => p.tier === 'silver').length,
        },
      },
    });
  });
}
