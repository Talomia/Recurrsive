/**
 * @module API Proxy Route
 *
 * Catch-all Next.js API route that proxies requests to the Recurrsive
 * server at runtime. This replaces the next.config.ts rewrite proxy
 * which bakes the destination URL at build time (incompatible with
 * Docker standalone mode where the server URL varies by environment).
 *
 * The upstream URL is determined by:
 *   1. INTERNAL_API_URL (runtime env — preferred for container-to-container)
 *   2. NEXT_PUBLIC_API_URL (build-time env — fallback)
 *   3. http://localhost:3000 (development default)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { isTrustedMutationOrigin } from '@/lib/request-origin';
import { mustOmitResponseBody } from '@/lib/proxy-response';

/** Upstream API server URL, resolved at runtime. */
function getUpstreamUrl(): string {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3000'
  );
}

/**
 * Proxy handler for all HTTP methods.
 * Forwards the request to the upstream server and returns the response.
 */
async function handler(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse | Response> {
  const { path } = await params;
  const upstream = getUpstreamUrl();
  const targetPath = `/api/v1/${path.join('/')}`;
  const targetUrl = new URL(targetPath, upstream);
  const secureCookie = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (!isTrustedMutationOrigin(origin, request.nextUrl.origin, process.env.DASHBOARD_ORIGIN)) {
      return NextResponse.json({ error: 'Forbidden', message: 'Cross-origin request rejected.' }, { status: 403 });
    }
  }
  // Forward query parameters
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  // Build headers — forward relevant ones, skip hop-by-hop headers
  const headers = new Headers();
  const skipHeaders = new Set([
    'host',
    'connection',
    'transfer-encoding',
    'keep-alive',
    'cookie',
    'authorization',
    'content-length',
    'x-forwarded-host',
    'x-forwarded-proto',
  ]);

  request.headers.forEach((value, key) => {
    if (!skipHeaders.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set('x-forwarded-host', request.nextUrl.host);
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));
  const sessionToken = request.cookies.get('recurrsive_token')?.value;
  if (sessionToken) {
    headers.set('authorization', `Bearer ${sessionToken}`);
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      redirect: 'manual',
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? await request.text()
        : undefined,
    });

    // Forward the response with all headers
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      // Skip hop-by-hop and encoding headers
      if (!skipHeaders.has(key.toLowerCase()) && key.toLowerCase() !== 'content-encoding') {
        responseHeaders.set(key, value);
      }
    });

    const body = await response.arrayBuffer();
    const responseBody = mustOmitResponseBody(request.method, response.status) ? null : body;

    let result = new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (response.ok && contentType.includes('application/json')) {
      try {
        const json = JSON.parse(new TextDecoder().decode(body)) as { data?: { token?: string; redirectTo?: string }; token?: string };
        const issuedToken = json.data?.token ?? json.token;
        if (issuedToken) {
          if (json.data) delete json.data.token;
          delete json.token;
          const redirectTo = json.data?.redirectTo;
          if (path[0] === 'sso' && path[1] === 'callback' && redirectTo?.startsWith('/') && !redirectTo.startsWith('//')) {
            result = NextResponse.redirect(new URL(redirectTo, request.nextUrl.origin), 303);
          } else {
            result = NextResponse.json(json, { status: response.status, headers: responseHeaders });
          }
          result.cookies.set('recurrsive_token', issuedToken, {
            httpOnly: true,
            secure: secureCookie,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60,
          });
        }
      } catch {
        // Preserve the upstream response if its content-type is incorrect.
      }
    }
    if (response.status === 401) {
      result.cookies.set('recurrsive_token', '', { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/', maxAge: 0 });
    }
    if (response.ok && request.method === 'POST' && path.join('/') === 'auth/logout') {
      result.cookies.set('recurrsive_token', '', { httpOnly: true, secure: secureCookie, sameSite: 'lax', path: '/', maxAge: 0 });
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[API Proxy] Failed to proxy ${request.method} ${targetPath}: ${message}`);
    return NextResponse.json(
      { error: 'API proxy error', message: 'Upstream server unavailable.' },
      { status: 502 },
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
