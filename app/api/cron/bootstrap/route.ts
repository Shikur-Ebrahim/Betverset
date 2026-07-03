import { NextResponse } from 'next/server';
import {

  fetchAndStoreCountries,
  fetchAndStoreLeagues,
  fetchAndStoreFixturesForWindow,
  TOP_LEAGUES,
} from '@/lib/services/apiFootball';

const CRON_SECRET = process.env.CRON_SECRET || '';

function isAuthorized(req: Request): boolean {
  // Vercel cron calls include the secret in Authorization header
  const auth = req.headers.get('authorization');
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) return true;
  // Also allow internal calls with no secret configured
  if (!CRON_SECRET) return true;
  return false;
}

// POST /api/cron/bootstrap — Vercel cron: daily full sync
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[cron/bootstrap] Starting bootstrap sync...');
    const [countries, leagues, fixtures] = await Promise.all([
      fetchAndStoreCountries(),
      fetchAndStoreLeagues(TOP_LEAGUES),
      fetchAndStoreFixturesForWindow(),
    ]);

    console.log('[cron/bootstrap] Done:', { countries, leagues, fixtures });
    return NextResponse.json({ ok: true, countries, leagues, fixtures });
  } catch (err: any) {
    console.error('[cron/bootstrap] Failed:', err);
    return NextResponse.json({ error: err.message || 'Bootstrap sync failed' }, { status: 500 });
  }
}

// GET also allowed for manual trigger from browser
export async function GET(req: Request) {
  return POST(req);
}

export const dynamic = 'force-dynamic';
