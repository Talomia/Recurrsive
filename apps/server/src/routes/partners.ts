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
 * Data is stored in-memory with realistic seeded content.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';

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

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

const partners: Map<string, Partner> = new Map();
const certifications: Map<string, Certification> = new Map();
const applications: Map<string, PartnerApplication> = new Map();

// Seed partners
const SEED_PARTNERS: Omit<Partner, 'id' | 'updatedAt'>[] = [
  {
    name: 'CloudForge Consulting',
    tier: 'platinum',
    type: 'system-integrator',
    description: 'Leading cloud transformation and engineering intelligence consultancy. Specializing in enterprise Recurrsive deployments with custom analyzer development.',
    specializations: ['Cloud Architecture', 'DevOps Transformation', 'AI/ML Operations'],
    regions: ['North America', 'Europe'],
    website: 'https://cloudforge.io',
    contactEmail: 'partners@cloudforge.io',
    certifiedEngineers: 24,
    customerCount: 45,
    joinedAt: '2026-01-15T00:00:00Z',
  },
  {
    name: 'DevOps Pro Solutions',
    tier: 'platinum',
    type: 'consulting',
    description: 'Enterprise DevOps consulting firm with deep expertise in CI/CD optimization and engineering intelligence implementation.',
    specializations: ['CI/CD Optimization', 'Infrastructure as Code', 'Platform Engineering'],
    regions: ['North America', 'Asia Pacific'],
    website: 'https://devopspro.solutions',
    contactEmail: 'hello@devopspro.solutions',
    certifiedEngineers: 18,
    customerCount: 38,
    joinedAt: '2026-02-01T00:00:00Z',
  },
  {
    name: 'AI Safety Labs',
    tier: 'gold',
    type: 'technology',
    description: 'Pioneering AI safety and reliability tooling. Develops compliance packs and AI quality analyzers for regulated industries.',
    specializations: ['AI Safety', 'Compliance', 'Regulated Industries'],
    regions: ['Europe', 'North America'],
    website: 'https://aisafetylabs.com',
    contactEmail: 'partners@aisafetylabs.com',
    certifiedEngineers: 12,
    customerCount: 22,
    joinedAt: '2026-02-15T00:00:00Z',
  },
  {
    name: 'FinTech Assurance Group',
    tier: 'gold',
    type: 'consulting',
    description: 'Financial technology consulting with focus on security, compliance, and cost optimization for fintech engineering teams.',
    specializations: ['FinTech', 'Security Compliance', 'Cost Optimization'],
    regions: ['North America', 'Europe', 'Asia Pacific'],
    website: 'https://fintechassurance.com',
    contactEmail: 'info@fintechassurance.com',
    certifiedEngineers: 9,
    customerCount: 16,
    joinedAt: '2026-03-01T00:00:00Z',
  },
  {
    name: 'Platform Engineering Co',
    tier: 'gold',
    type: 'system-integrator',
    description: 'Platform engineering specialists building internal developer platforms powered by Recurrsive intelligence.',
    specializations: ['Platform Engineering', 'Developer Experience', 'Kubernetes'],
    regions: ['Europe', 'Asia Pacific'],
    website: 'https://platformeng.co',
    contactEmail: 'partners@platformeng.co',
    certifiedEngineers: 15,
    customerCount: 28,
    joinedAt: '2026-03-15T00:00:00Z',
  },
  {
    name: 'NexGen Cloud Partners',
    tier: 'silver',
    type: 'cloud-provider',
    description: 'Cloud infrastructure provider offering managed Recurrsive hosting with optimized compute for AI reasoning workloads.',
    specializations: ['Cloud Hosting', 'GPU Infrastructure', 'Managed Services'],
    regions: ['North America', 'Europe'],
    website: 'https://nexgencloud.io',
    contactEmail: 'partnerships@nexgencloud.io',
    certifiedEngineers: 6,
    customerCount: 11,
    joinedAt: '2026-04-01T00:00:00Z',
  },
  {
    name: 'SecureStack Advisory',
    tier: 'silver',
    type: 'consulting',
    description: 'Cybersecurity consultancy integrating Recurrsive security analysis into enterprise security programs.',
    specializations: ['Security', 'Penetration Testing', 'Compliance'],
    regions: ['North America'],
    website: 'https://securestack.io',
    contactEmail: 'partners@securestack.io',
    certifiedEngineers: 4,
    customerCount: 8,
    joinedAt: '2026-04-15T00:00:00Z',
  },
  {
    name: 'DataLens Analytics',
    tier: 'silver',
    type: 'technology',
    description: 'Data analytics platform with custom Recurrsive collectors for data pipeline quality monitoring.',
    specializations: ['Data Engineering', 'Analytics', 'Pipeline Quality'],
    regions: ['Europe'],
    website: 'https://datalens.dev',
    contactEmail: 'hello@datalens.dev',
    certifiedEngineers: 3,
    customerCount: 5,
    joinedAt: '2026-05-01T00:00:00Z',
  },
];

const SEED_CERTIFICATIONS: Omit<Certification, 'id'>[] = [
  {
    level: 'analyst',
    name: 'Recurrsive Analyst',
    description: 'Validates proficiency in using Recurrsive for engineering analysis. Covers CLI usage, report interpretation, finding triage, and opportunity evaluation.',
    requirements: ['6 months experience with Recurrsive', 'Familiarity with software analysis concepts', 'Basic understanding of knowledge graphs'],
    examDuration: '90 minutes',
    cost: 299,
    passingScore: 75,
    validityPeriod: '2 years',
    enrolledCount: 342,
    passRate: 78,
  },
  {
    level: 'architect',
    name: 'Recurrsive Architect',
    description: 'Advanced certification for engineers designing custom analyzers, collectors, and intelligence workflows. Includes hands-on lab component.',
    requirements: ['Recurrsive Analyst certification', '1 year experience with Recurrsive', 'Experience developing plugins or custom analyzers', 'Understanding of multi-agent reasoning'],
    examDuration: '3 hours (including hands-on lab)',
    cost: 599,
    passingScore: 80,
    validityPeriod: '2 years',
    enrolledCount: 128,
    passRate: 65,
  },
  {
    level: 'administrator',
    name: 'Recurrsive Administrator',
    description: 'Validates expertise in deploying, configuring, and managing Recurrsive at enterprise scale. Covers SSO, RBAC, audit logging, and multi-tenant setups.',
    requirements: ['Recurrsive Analyst certification', 'Experience with Recurrsive Server administration', 'Understanding of Docker/Kubernetes deployment', 'Familiarity with SSO/SAML, RBAC, and audit logging'],
    examDuration: '2 hours (practical assessment)',
    cost: 499,
    passingScore: 80,
    validityPeriod: '2 years',
    enrolledCount: 87,
    passRate: 71,
  },
];

// Seed data
function seedPartnerData() {
  const now = nowISO();
  SEED_PARTNERS.forEach((p) => {
    const id = generateId();
    if (partners.size < SEED_PARTNERS.length) {
      partners.set(id, { ...p, id, updatedAt: now });
    }
  });
  SEED_CERTIFICATIONS.forEach((c) => {
    const id = `cert-${c.level}`;
    if (!certifications.has(id)) {
      certifications.set(id, { ...c, id });
    }
  });
}
seedPartnerData();

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
  app.get(prefix, async (request, reply) => {
    const query = request.query as { tier?: PartnerTier; type?: PartnerType; region?: string };

    let results = Array.from(partners.values());

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
  app.get(`${prefix}/:id`, async (request, reply) => {
    const { id } = request.params as { id: string };
    const partner = partners.get(id);
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
  app.post(`${prefix}/apply`, async (request, reply) => {
    const body = request.body as Omit<PartnerApplication, 'id' | 'status' | 'submittedAt'>;

    if (!body.companyName || !body.contactEmail || !body.partnerType) {
      return reply.status(400).send({
        error: 'Missing required fields: companyName, contactEmail, partnerType',
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

    applications.set(id, application);

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
  app.get(`${prefix}/certifications`, async (_request, reply) => {
    return reply.send({
      data: Array.from(certifications.values()),
    });
  });

  /**
   * GET /api/v1/partners/stats
   *
   * Partner program statistics.
   */
  app.get(`${prefix}/stats`, async (_request, reply) => {
    const all = Array.from(partners.values());
    const totalEngineers = all.reduce((sum, p) => sum + p.certifiedEngineers, 0);
    const totalCustomers = all.reduce((sum, p) => sum + p.customerCount, 0);

    return reply.send({
      data: {
        totalPartners: all.length,
        totalCertifiedEngineers: totalEngineers,
        totalCustomersServed: totalCustomers,
        certificationTracks: certifications.size,
        pendingApplications: Array.from(applications.values()).filter((a) => a.status === 'pending').length,
        tierDistribution: {
          platinum: all.filter((p) => p.tier === 'platinum').length,
          gold: all.filter((p) => p.tier === 'gold').length,
          silver: all.filter((p) => p.tier === 'silver').length,
        },
      },
    });
  });
}
