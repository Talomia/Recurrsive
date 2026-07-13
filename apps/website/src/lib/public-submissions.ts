import { NextResponse } from 'next/server';

const MAX_SUBMISSION_BYTES = 16 * 1024;

/** Forward a validated-size public form to the private API network. */
export async function forwardPublicSubmission(request: Request, path: string): Promise<NextResponse> {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > MAX_SUBMISSION_BYTES) {
    return NextResponse.json({ error: 'Submission is too large.' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 });
  }

  const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => ({
      error: response.ok ? undefined : 'The submission could not be processed.',
    }));
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: 'The submission service is temporarily unavailable. Please try again.' },
      { status: 503 },
    );
  }
}
