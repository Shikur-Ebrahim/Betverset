import { NextResponse } from 'next/server';

import { getPublicApiBaseUrl } from '@/lib/public-api-url';

function backendAuthUrl(action: 'login' | 'signup'): string {
  try {
    return `${getPublicApiBaseUrl()}/auth/${action}`;
  } catch {
    return `https://betvers-backend.onrender.com/api/auth/${action}`;
  }
}

function backendHealthUrl(): string {
  try {
    return `${getPublicApiBaseUrl()}/health`;
  } catch {
    return 'https://betvers-backend.onrender.com/api/health';
  }
}

export async function warmAuthBackend(): Promise<void> {
  try {
    await fetch(backendHealthUrl(), {
      method: 'GET',
      cache: 'no-store',
    });
  } catch {
    /* best-effort warm-up */
  }
}

export async function proxyAuthToBackend(
  action: 'login' | 'signup',
  body: string
): Promise<NextResponse> {
  try {
    const upstream = await fetch(backendAuthUrl(action), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
      cache: 'no-store',
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`[auth/${action}] proxy:`, err);
    return NextResponse.json(
      { error: 'Could not reach the server. Please try again in a moment.' },
      { status: 502 }
    );
  }
}
