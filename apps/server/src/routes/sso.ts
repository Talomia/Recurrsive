/**
 * @module @recurrsive/server/routes/sso
 *
 * SSO/SAML integration routes.
 *
 * Provides SAML 2.0 Single Sign-On support with configurable identity
 * providers (Okta, Auth0, Azure AD, Google Workspace). Parses real
 * SAML responses (base64-decoded XML) and validates assertions.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';
import { createToken, authMiddleware } from '../middleware/auth.js';
import { store } from '../store.js';
import { findOrCreateSSOUser } from '../middleware/users.js';
import { SAML, ValidateInResponseTo, type CacheItem, type CacheProvider, type Profile } from '@node-saml/node-saml';
import { requireRole } from '../middleware/rbac.js';
import { X509Certificate } from 'node:crypto';

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
  /** Identity provider issuer/entity ID. */
  idpEntityId: string;
  /** Recurrsive service-provider entity ID and expected Audience. */
  spEntityId: string;
  /** SSO Login URL. */
  ssoUrl: string;
  /** Certificate (Base64-encoded X.509). */
  certificate: string;
  /** Which signed SAML elements the integration requires. */
  signatureMode: 'both' | 'response' | 'assertion' | 'either';
  /** Restrict SSO accounts to these email domains (empty means any). */
  allowedDomains: string[];
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

/** SAML assertion parsed from an IdP response. */
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

/** Stored SSO session record. */
interface SSOSession {
  id: string;
  userId: string;
  email: string;
  issuer: string;
  expiresAt: string;
  createdAt: string;
}

// No seed data — SSO providers are configured by the user via the API.

// ---------------------------------------------------------------------------
// SAML validation
// ---------------------------------------------------------------------------

class SamlRequestCache implements CacheProvider {
  constructor(private readonly provider: string) {}

  private key(id: string): string { return `${this.provider}:${id}`; }

  async saveAsync(key: string, value: string): Promise<CacheItem> {
    const item = { value, createdAt: Date.now() };
    await store.set('saml_requests', this.key(key), item);
    return item;
  }

  async getAsync(key: string): Promise<string | null> {
    const item = await store.get<CacheItem>('saml_requests', this.key(key));
    if (item && Date.now() - item.createdAt > 10 * 60_000) {
      await store.delete('saml_requests', this.key(key));
      return null;
    }
    return item?.value ?? null;
  }

  async removeAsync(key: string | null): Promise<string | null> {
    if (!key) return null;
    const storedKey = this.key(key);
    const item = await store.get<CacheItem>('saml_requests', storedKey);
    if (item) await store.delete('saml_requests', storedKey);
    return item?.value ?? null;
  }
}

function externalBaseUrl(request: { protocol: string; hostname: string; headers: Record<string, unknown> }): string {
  if (process.env['PUBLIC_APP_URL']) return process.env['PUBLIC_APP_URL'].replace(/\/$/, '');
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('PUBLIC_APP_URL is required for SSO in production.');
  }
  const proto = String(request.headers['x-forwarded-proto'] ?? request.protocol).split(',')[0]!.trim();
  const host = String(request.headers['x-forwarded-host'] ?? request.hostname).split(',')[0]!.trim();
  if (process.env['NODE_ENV'] === 'production' && proto !== 'https') {
    throw new Error('PUBLIC_APP_URL or HTTPS forwarded headers are required for SSO in production.');
  }
  return `${proto}://${host}`;
}

function samlClient(provider: string, config: SSOConfig, callbackUrl: string): SAML {
  const requireResponse = config.signatureMode === 'both' || config.signatureMode === 'response';
  const requireAssertion = config.signatureMode === 'both' || config.signatureMode === 'assertion';
  return new SAML({
    callbackUrl,
    entryPoint: config.ssoUrl,
    issuer: config.spEntityId,
    audience: config.spEntityId,
    idpIssuer: config.idpEntityId,
    idpCert: config.certificate,
    wantAuthnResponseSigned: requireResponse,
    wantAssertionsSigned: requireAssertion,
    validateInResponseTo: ValidateInResponseTo.always,
    requestIdExpirationPeriodMs: 10 * 60_000,
    maxAssertionAgeMs: 10 * 60_000,
    acceptedClockSkewMs: 60_000,
    cacheProvider: new SamlRequestCache(provider),
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
  });
}

function attributeValues(profile: Profile, name: string): string[] {
  const value = profile[name];
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return value === undefined || value === null ? [] : [String(value).trim()].filter(Boolean);
}

function assertionFromProfile(config: SSOConfig, profile: Profile): SAMLAssertion {
  if (profile.issuer !== config.idpEntityId) throw new Error('SAML issuer does not match the configured identity provider.');
  const mapped = config.attributeMapping;
  const first = (name: string, fallbacks: string[] = []) =>
    [name, ...fallbacks].flatMap((key) => attributeValues(profile, key))[0];
  const email = first(mapped.email, ['email', 'mail', 'urn:oid:0.9.2342.19200300.100.1.3']) ?? profile.nameID;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('The signed assertion does not contain a valid email address.');
  const domain = email.split('@')[1]!.toLowerCase();
  if (config.allowedDomains.length && !config.allowedDomains.map((item) => item.toLowerCase()).includes(domain)) {
    throw new Error('The SSO account domain is not allowed for this provider.');
  }
  const groups = attributeValues(profile, mapped.groups);
  let role: 'admin' | 'analyst' | 'viewer' = config.defaultRole;
  for (const group of groups) {
    const mappedRole = config.groupRoleMapping[group];
    if (mappedRole) { role = mappedRole; break; }
  }
  const now = new Date();
  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(profile)) {
    if (typeof value === 'string') attributes[key] = value;
  }
  return {
    id: profile.ID ?? generateId(),
    issuer: profile.issuer,
    userId: first(mapped.userId) ?? profile.nameID,
    email,
    firstName: first(mapped.firstName, ['firstName', 'givenName']) ?? email.split('@')[0]!,
    lastName: first(mapped.lastName, ['lastName', 'sn']) ?? '',
    role,
    groups,
    attributes,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
  };
}



// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerSSORoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/sso/discovery', async (_request, reply) => {
    const providers = (await store.entries<SSOConfig>('sso_configs')).map(([id, config]) => ({
      id,
      displayName: config.displayName,
      provider: config.provider,
    }));
    return reply.send({ data: providers, total: providers.length });
  });

  // List SSO configurations
  app.get('/api/v1/sso/providers', { preHandler: [authMiddleware, requireRole('admin')] }, async (_request, reply) => {
    const allConfigs = await store.entries<SSOConfig>('sso_configs');
    const providers = allConfigs.map(([id, config]) => ({
      id,
      provider: config.provider,
      displayName: config.displayName,
      idpEntityId: config.idpEntityId,
      spEntityId: config.spEntityId,
      ssoUrl: config.ssoUrl,
      autoProvision: config.autoProvision,
      defaultRole: config.defaultRole,
      createdAt: config.createdAt,
    }));

    return reply.send({ data: providers, total: providers.length });
  });

  // Get SSO config details
  app.get<{ Params: { id: string } }>('/api/v1/sso/providers/:id', { preHandler: [authMiddleware, requireRole('admin')] }, async (request, reply) => {
    const config = await store.get<SSOConfig>('sso_configs', request.params.id);
    if (!config) return reply.status(404).send({ error: 'Not Found', message: 'SSO provider not found' });
    return reply.send({ data: config });
  });

  app.get<{ Params: { id: string } }>('/api/v1/sso/providers/:id/metadata', { preHandler: [authMiddleware, requireRole('admin')] }, async (request, reply) => {
    const config = await store.get<SSOConfig>('sso_configs', request.params.id);
    if (!config) return reply.status(404).send({ error: 'Not Found', message: 'SSO provider not found' });
    const callbackUrl = `${externalBaseUrl(request)}/api/v1/sso/callback/${request.params.id}`;
    const metadata = samlClient(request.params.id, config, callbackUrl).generateServiceProviderMetadata(null, null);
    return reply.header('Content-Type', 'application/samlmetadata+xml; charset=utf-8').send(metadata);
  });

  // Create/Update SSO config
  app.put<{ Params: { id: string } }>('/api/v1/sso/providers/:id', {
    preHandler: [authMiddleware, requireRole('admin')],
    schema: {
      body: {
        type: 'object',
        properties: {
          provider: { type: 'string', enum: ['okta', 'auth0', 'azure-ad', 'google-workspace', 'custom'] },
          displayName: { type: 'string', minLength: 1 },
          idpEntityId: { type: 'string', minLength: 1 },
          spEntityId: { type: 'string', minLength: 1 },
          ssoUrl: { type: 'string', minLength: 1 },
          certificate: { type: 'string', minLength: 1 },
          signatureMode: { type: 'string', enum: ['both', 'response', 'assertion', 'either'] },
          allowedDomains: { type: 'array', uniqueItems: true, items: { type: 'string', pattern: '^[A-Za-z0-9.-]+$' } },
          attributeMapping: { type: 'object' },
          autoProvision: { type: 'boolean' },
          defaultRole: { type: 'string', enum: ['admin', 'analyst', 'viewer'] },
          groupRoleMapping: { type: 'object' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(request.params.id)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Provider ID must use lowercase letters, numbers, and single hyphens.' });
    }
    const body = request.body as Partial<SSOConfig>;
    const existing = await store.get<SSOConfig>('sso_configs', request.params.id);
    const now = nowISO();

    const config: SSOConfig = {
      provider: body.provider ?? existing?.provider ?? 'custom',
      displayName: body.displayName ?? existing?.displayName ?? request.params.id,
      idpEntityId: body.idpEntityId ?? existing?.idpEntityId ?? '',
      spEntityId: body.spEntityId ?? existing?.spEntityId ?? '',
      ssoUrl: body.ssoUrl ?? existing?.ssoUrl ?? '',
      certificate: body.certificate ?? existing?.certificate ?? '',
      signatureMode: body.signatureMode ?? existing?.signatureMode ?? 'both',
      allowedDomains: (body.allowedDomains ?? existing?.allowedDomains ?? []).map((domain) => domain.toLowerCase()),
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

    if (!config.idpEntityId || !config.spEntityId || !config.ssoUrl || !config.certificate) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'idpEntityId, spEntityId, ssoUrl, and certificate are required.',
      });
    }
    const requiredMappings: Array<keyof SSOConfig['attributeMapping']> = [
      'userId', 'email', 'firstName', 'lastName', 'role', 'groups',
    ];
    if (requiredMappings.some((key) => typeof config.attributeMapping[key] !== 'string' || !config.attributeMapping[key].trim())) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `attributeMapping must define non-empty strings for: ${requiredMappings.join(', ')}.`,
      });
    }
    if (Object.entries(config.groupRoleMapping).some(([group, role]) =>
      !group.trim() || !['admin', 'analyst', 'viewer'].includes(role),
    )) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Group role mappings must use non-empty group names and valid roles.' });
    }
    try {
      const ssoUrl = new URL(config.ssoUrl);
      if (ssoUrl.protocol !== 'https:') throw new Error('The IdP SSO URL must use HTTPS.');
      const compactCertificate = config.certificate.replace(/-----[^-]+-----|\s+/g, '');
      config.certificate = config.certificate.includes('BEGIN CERTIFICATE')
        ? config.certificate
        : `-----BEGIN CERTIFICATE-----\n${compactCertificate.match(/.{1,64}/g)?.join('\n') ?? compactCertificate}\n-----END CERTIFICATE-----`;
      new X509Certificate(config.certificate);
      samlClient(request.params.id, config, `${externalBaseUrl(request)}/api/v1/sso/callback/${request.params.id}`);
    } catch (error) {
      return reply.status(400).send({ error: 'Bad Request', message: error instanceof Error ? error.message : 'Invalid SSO configuration' });
    }

    await store.set<SSOConfig>('sso_configs', request.params.id, config);
    return reply.status(existing ? 200 : 201).send({ data: config });
  });

  // Delete SSO config
  app.delete<{ Params: { id: string } }>('/api/v1/sso/providers/:id', { preHandler: [authMiddleware, requireRole('admin')] }, async (request, reply) => {
    if (!await store.has('sso_configs', request.params.id)) {
      return reply.status(404).send({ error: 'Not Found', message: 'SSO provider not found' });
    }
    await store.delete('sso_configs', request.params.id);
    return reply.status(204).send();
  });

  // Initiate SSO login (redirect to IdP)
  app.get<{ Params: { provider: string }; Querystring: { returnTo?: string } }>('/api/v1/sso/login/:provider', async (request, reply) => {
    const config = await store.get<SSOConfig>('sso_configs', request.params.provider);
    if (!config) return reply.status(404).send({ error: 'Not Found', message: 'SSO provider not configured' });

    const returnTo = request.query.returnTo?.startsWith('/') && !request.query.returnTo.startsWith('//')
      ? request.query.returnTo : '/';
    const acsUrl = `${externalBaseUrl(request)}/api/v1/sso/callback/${request.params.provider}`;
    const redirectUrl = await samlClient(request.params.provider, config, acsUrl)
      .getAuthorizeUrlAsync(returnTo, request.hostname, {});

    return reply.redirect(redirectUrl);
  });

  // SSO callback (process SAML response)
  app.post<{ Params: { provider: string } }>('/api/v1/sso/callback/:provider', {
    schema: {
      body: {
        type: 'object',
        required: ['SAMLResponse'],
        properties: {
          SAMLResponse: { type: 'string', minLength: 1, maxLength: 2_000_000 },
          RelayState: { type: 'string', maxLength: 2048 },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const config = await store.get<SSOConfig>('sso_configs', request.params.provider);
    if (!config) return reply.status(404).send({ error: 'Not Found', message: 'SSO provider not configured' });

    const body = request.body as { SAMLResponse?: string; RelayState?: string };
    if (!body.SAMLResponse) {
      return reply.status(400).send({ error: 'Bad Request', message: 'SAMLResponse is required' });
    }

    // Validate XML signature(s), Audience, Recipient/Destination, Conditions,
    // request correlation, and one-time request use before reading attributes.
    let assertion: SAMLAssertion;
    try {
      const acsUrl = `${externalBaseUrl(request)}/api/v1/sso/callback/${request.params.provider}`;
      const validated = await samlClient(request.params.provider, config, acsUrl)
        .validatePostResponseAsync({ SAMLResponse: body.SAMLResponse });
      if (!validated.profile || validated.loggedOut) throw new Error('SAML response did not contain an authentication assertion.');
      assertion = assertionFromProfile(config, validated.profile);
    } catch (err) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: err instanceof Error ? err.message : 'Failed to parse SAML response',
      });
    }

    const role = assertion.role as 'admin' | 'analyst' | 'viewer';

    // Auto-provision or find existing user in the user store
    const autoProvision = config.autoProvision !== false;
    const ssoUser = await findOrCreateSSOUser(
      request.params.provider,
      assertion.email,
      assertion.firstName,
      assertion.lastName,
      role,
      autoProvision,
    );

    if (!ssoUser || ssoUser.status !== 'active') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: autoProvision ? 'The SSO account cannot be linked to an active user.' : 'SSO auto-provisioning is disabled and no linked user exists.',
      });
    }

    const userId = ssoUser.id;
    const username = ssoUser.username;
    const effectiveRole = ssoUser.role as 'admin' | 'analyst' | 'viewer';

    const sessionId = generateId();
    // Bind the JWT identifier to the SSO session so revocation immediately
    // invalidates the issued token.
    const token = createToken(userId, effectiveRole, undefined, username, sessionId, ssoUser.sessionVersion);

    // Store session
    await store.set<SSOSession>('sso_sessions', sessionId, {
      id: sessionId,
      userId,
      email: assertion.email,
      issuer: assertion.issuer,
      expiresAt: assertion.expiresAt,
      createdAt: nowISO(),
    });

    return reply.send({
      data: {
        token,
        sessionId,
        user: {
          id: userId,
          email: assertion.email,
          name: `${assertion.firstName} ${assertion.lastName}`,
          role: effectiveRole,
          provider: request.params.provider,
        },
        expiresAt: assertion.expiresAt,
        redirectTo: body.RelayState?.startsWith('/') && !body.RelayState.startsWith('//') ? body.RelayState : '/',
      },
    });
  });

  // List active SSO sessions
  app.get('/api/v1/sso/sessions', { preHandler: [authMiddleware, requireRole('admin')] }, async (_request, reply) => {
    const allSessions = await store.all<SSOSession>('sso_sessions');
    const now = Date.now();
    const expired = allSessions.filter((session) => new Date(session.expiresAt).getTime() <= now);
    await Promise.all(expired.map((session) => store.delete('sso_sessions', session.id)));
    const sessions = allSessions.filter((session) => new Date(session.expiresAt).getTime() > now).map((session) => ({
      sessionId: session.id,
      userId: session.userId,
      email: session.email,
      provider: session.issuer,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    }));

    return reply.send({ data: sessions, total: sessions.length });
  });

  // Revoke SSO session
  app.delete<{ Params: { id: string } }>('/api/v1/sso/sessions/:id', { preHandler: [authMiddleware, requireRole('admin')] }, async (request, reply) => {
    if (!await store.has('sso_sessions', request.params.id)) {
      return reply.status(404).send({ error: 'Not Found', message: 'Session not found' });
    }
    const session = await store.get<SSOSession>('sso_sessions', request.params.id);
    await store.set('revoked_tokens', request.params.id, {
      revokedAt: nowISO(),
      expiresAt: session ? Math.floor(new Date(session.expiresAt).getTime() / 1000) : undefined,
    });
    await store.delete('sso_sessions', request.params.id);
    return reply.status(204).send();
  });
}
