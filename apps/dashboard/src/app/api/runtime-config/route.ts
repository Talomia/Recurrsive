import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiUrl = process.env['PUBLIC_API_URL'];
  if (!apiUrl) {
    return NextResponse.json({ error: 'PUBLIC_API_URL is not configured' }, { status: 503 });
  }
  const websocketUrl = `${apiUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:').replace(/\/$/, '')}/ws`;
  return NextResponse.json({ websocketUrl }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
