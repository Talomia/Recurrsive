/**
 * @module @recurrsive/server/middleware/sso
 *
 * SSO/SAML integration middleware.
 *
 * Provides SAML 2.0 Single Sign-On support with configurable identity
 * providers (Okta, Auth0, Azure AD, Google Workspace). Since there
 * are no real users, the middleware simulates SAML assertions with
 * synthetic user data.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';
import { createToken } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported identity providers. */
export type IdentityProvider = 'okta' | 'auth0' | 'azure-ad' | 'google-workspace' | 'custom';

/** SSO configuration. */
export interface SSOConfig {
  /** Provider type. */
  provider: IdentityProvider;
  /** Provider display name. */
  displayName: string;
  /** Entity ID / Issuer. */
  entityId: string;
  /** SSO Login URL. */
  ssoUrl: string;
  /** Certificate (Base64-encoded X.509). */
  certificate: string;
  /** Attribute mapping for SAML assertions. */
  attributeMapping: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    groups: string;
  };
  /** Auto-provision users on first login. */
  autoProvision: boolean;
  /** Default role for new SSO users. */
  defaultRole: 'admin' | 'analyst' | 'viewer';
  /** JIT group-to-role mapping. */
  groupRoleMapping: Record<string, 'admin' | 'analyst' | 'viewer'>;
  /** Created timestamp. */
  createdAt: string;
  /** Updated timestamp. */
  updatedAt: string;
}

/** SAML assertion (simplified, synthetic). */
export interface SAMLAssertion {
  id: string;
  issuer: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  groups: string[];
  attributes: Record<string, string>;
  issuedAt: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// In-memory SSO configuration store
// ---------------------------------------------------------------------------

const ssoConfigs: Map<string, SSOConfig> = new Map();
const ssoSessions: Map<string, { assertion: SAMLAssertion; token: string; createdAt: string }> = new Map();

// Seed demo SSO configuration
const demoConfig: SSOConfig = {
  provider: 'okta',
  displayName: 'Talomia Okta',
  entityId: 'https://talomia.okta.com/app/recurrsive',
  ssoUrl: 'https://talomia.okta.com/app/recurrsive/sso/saml',
  certificate: 'MIIDnjCCAoagAwIBAgIGAX0... (truncated demo cert)',
  attributeMapping: {
    userId: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
    email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
    lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
    role: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role',
    groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
  },
  autoProvision: true,
  defaultRole: 'analyst',
  groupRoleMapping: {
    'engineering-leads': 'admin',
    'senior-engineers': 'analyst',
    'all-engineers': 'viewer',
  },
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: nowISO(),
};
ssoConfigs.set('okta', demoConfig);

// ---------------------------------------------------------------------------
// Synthetic SAML response processor
// ---------------------------------------------------------------------------

/** Simulate parsing a SAML response. In real impl, this would decode XML. */
function parseSAMLResponse(provider: string, _samlResponse: string): SAMLAssertion {
  const config = ssoConfigs.get(provider);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 8 * 3600 * 1000);

  // Synthetic demo users per provider
  const demoUsers: Record<string, Omit<SAMLAssertion, 'id' | 'issuedAt' | 'expiresAt'>> = {
    okta: {
      issuer: config?.entityId ?? 'https://idp.example.com',
      userId: 'sso-user-okta-001',
      email: 'sarah.chen@talomia.io',
      firstName: 'Sarah',
      lastName: 'Chen',
      role: 'admin',
      groups: ['engineering-leads', 'platform-team'],
      attributes: { department: 'Engineering', title: 'Staff Engineer' },
    },
    'auth0': {
      issuer: 'https://talomia.auth0.com',
      userId: 'sso-user-auth0-001',
      email: 'marcus.johnson@talomia.io',
      firstName: 'Marcus',
      lastName: 'Johnson',
      role: 'analyst',
      groups: ['senior-engineers', 'ml-team'],
      attributes: { department: 'AI/ML', title: 'Senior ML Engineer' },
    },
    'azure-ad': {
      issuer: 'https://login.microsoftonline.com/talomia',
      userId: 'sso-user-azure-001',
      email: 'priya.patel@talomia.io',
      firstName: 'Priya',
      lastName: 'Patel',
      role: 'viewer',
      groups: ['all-engineers', 'frontend-team'],
      attributes: { department: 'Frontend', title: 'Frontend Engineer' },
    },
  };

  const user = demoUsers[provider] ?? demoUsers['okta']!;

  return {
    id: generateId(),
    ...user,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

/** Resolve role from assertion groups using config mapping. */
function resolveRole(assertion: SAMLAssertion, config: SSOConfig): 'admin' | 'analyst' | 'viewer' {
  for (const group of assertion.groups) {
    const mapped = config.groupRoleMapping[group];
    if (mapped) return mapped;
  }
  return config.defaultRole;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerSSORoutes(app: FastifyInstance): Promise<void> {
  // List SSO configurations
  app.get('/api/v1/sso/providers', async (_request, reply) => {
    const providers = Array.from(ssoConfigs.entries()).map(([key, config]) => ({
      id: key,
      provider: config.provider,
      displayName: config.displayName,
      entityId: config.entityId,
      ssoUrl: config.ssoUrl,
      autoProvision: config.autoProvision,
      defaultRole: config.defaultRole,
      createdAt: config.createdAt,
    }));

    return reply.send({ data: providers, total: providers.length });
  });

  // Get SSO config details
  app.get<{ Params: { id: string } }>('/api/v1/sso/providers/:id', async (request, reply) => {
    const config = ssoConfigs.get(request.params.id);
    if (!config) return reply.status(404).send({ error: 'SSO provider not found' });
    return reply.send({ data: config });
  });

  // Create/Update SSO config
  app.put<{ Params: { id: string } }>('/api/v1/sso/providers/:id', async (request, reply) => {
    const body = request.body as Partial<SSOConfig>;
    const existing = ssoConfigs.get(request.params.id);
    const now = nowISO();

    const config: SSOConfig = {
      provider: body.provider ?? existing?.provider ?? 'custom',
      displayName: body.displayName ?? existing?.displayName ?? request.params.id,
      entityId: body.entityId ?? existing?.entityId ?? '',
      ssoUrl: body.ssoUrl ?? existing?.ssoUrl ?? '',
      certificate: body.certificate ?? existing?.certificate ?? '',
      attributeMapping: body.attributeMapping ?? existing?.attributeMapping ?? {
        userId: 'nameidentifier', email: 'emailaddress',
        firstName: 'givenname', lastName: 'surname',
        role: 'role', groups: 'groups',
      },
      autoProvision: body.autoProvision ?? existing?.autoProvision ?? true,
      defaultRole: body.defaultRole ?? existing?.defaultRole ?? 'viewer',
      groupRoleMapping: body.groupRoleMapping ?? existing?.groupRoleMapping ?? {},
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    ssoConfigs.set(request.params.id, config);
    return reply.status(existing ? 200 : 201).send({ data: config });
  });

  // Delete SSO config
  app.delete<{ Params: { id: string } }>('/api/v1/sso/providers/:id', async (request, reply) => {
    if (!ssoConfigs.has(request.params.id)) {
      return reply.status(404).send({ error: 'SSO provider not found' });
    }
    ssoConfigs.delete(request.params.id);
    return reply.status(204).send();
  });

  // Initiate SSO login (redirect to IdP)
  app.get<{ Params: { provider: string } }>('/api/v1/sso/login/:provider', async (request, reply) => {
    const config = ssoConfigs.get(request.params.provider);
    if (!config) return reply.status(404).send({ error: 'SSO provider not configured' });

    // In real impl, this would generate a SAML AuthnRequest and redirect
    return reply.send({
      redirectUrl: config.ssoUrl,
      provider: config.provider,
      entityId: config.entityId,
      message: 'Redirect user to SSO URL. The IdP will POST back to /api/v1/sso/callback/:provider',
    });
  });

  // SSO callback (process SAML response)
  app.post<{ Params: { provider: string } }>('/api/v1/sso/callback/:provider', async (request, reply) => {
    const config = ssoConfigs.get(request.params.provider);
    if (!config) return reply.status(404).send({ error: 'SSO provider not configured' });

    const body = request.body as { SAMLResponse?: string };
    const samlResponse = body.SAMLResponse ?? 'synthetic-saml-response';

    // Parse SAML assertion (synthetic)
    const assertion = parseSAMLResponse(request.params.provider, samlResponse);
    const role = resolveRole(assertion, config);

    // Create JWT token for the SSO user
    const token = createToken(assertion.userId, role);

    // Store session
    const sessionId = generateId();
    ssoSessions.set(sessionId, {
      assertion,
      token,
      createdAt: nowISO(),
    });

    return reply.send({
      data: {
        token,
        sessionId,
        user: {
          id: assertion.userId,
          email: assertion.email,
          name: `${assertion.firstName} ${assertion.lastName}`,
          role,
          groups: assertion.groups,
          provider: request.params.provider,
          attributes: assertion.attributes,
        },
        expiresAt: assertion.expiresAt,
      },
    });
  });

  // List active SSO sessions
  app.get('/api/v1/sso/sessions', async (_request, reply) => {
    const sessions = Array.from(ssoSessions.entries()).map(([id, session]) => ({
      sessionId: id,
      userId: session.assertion.userId,
      email: session.assertion.email,
      provider: session.assertion.issuer,
      createdAt: session.createdAt,
      expiresAt: session.assertion.expiresAt,
    }));

    return reply.send({ data: sessions, total: sessions.length });
  });

  // Revoke SSO session
  app.delete<{ Params: { id: string } }>('/api/v1/sso/sessions/:id', async (request, reply) => {
    if (!ssoSessions.has(request.params.id)) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    ssoSessions.delete(request.params.id);
    return reply.status(204).send();
  });
}
