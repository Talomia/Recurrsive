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
  ]);

  request.headers.forEach((value, key) => {
    if (!skipHeaders.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  // Direct browser navigations (e.g. `<a href download>` report/export links)
  // cannot attach the Bearer token from localStorage, so they arrive with only
  // the `recurrsive_token` cookie. Promote that cookie to an Authorization
  // header when none is present, so authenticated downloads don't 401.
  if (!headers.has('authorization')) {
    const cookieToken = request.cookies.get('recurrsive_token')?.value;
    if (cookieToken) {
      headers.set('authorization', `Bearer ${cookieToken}`);
    }
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
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

    return new NextResponse(body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[API Proxy] Failed to proxy ${request.method} ${targetPath}: ${message}`);
    return NextResponse.json(
      { error: 'API proxy error', message: `Upstream server unavailable: ${message}` },
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
