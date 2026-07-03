import { NextResponse } from 'next/server';

import { getPublicApiBaseUrl } from '@/lib/public-api-url';

function backendBase(): string {
  try {
    return getPublicApiBaseUrl();
  } catch {
    return 'https://betvers-backend.onrender.com/api';
  }
}

export async function proxyDepositBootstrap(authHeader: string | null): Promise<NextResponse> {
  if (!authHeader) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const upstream = await fetch(`${backendBase()}/user/deposit-bootstrap`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[deposit/bootstrap] proxy:', err);
    return NextResponse.json({ message: 'Could not reach deposit service' }, { status: 502 });
  }
}

export async function warmDepositBackend(): Promise<void> {
  try {
    await fetch(`${backendBase()}/health`, { method: 'GET', cache: 'no-store' });
  } catch {
    /* best-effort */
  }
}
