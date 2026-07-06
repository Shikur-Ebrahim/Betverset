/**
 * /api/cron/bootstrap
 * 
 * Run ONCE PER DAY (early morning) to populate the full 7-day fixture window
 * with pre-match odds and league data.
 *
 * Budget: ~80 API requests per run.
 * Schedule: "0 3 * * *" (3 AM UTC daily) in vercel.json
 */
import { NextResponse } from 'next/server';
import {
  fetchAndStoreCountries,
  fetchAndStoreLeagues,
  fetchAndStoreFixturesForWindow,
  TOP_LEAGUES,
} from '@/lib/services/apiFootball';

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || '';
  const auth = req.headers.get('authorization');
  // Vercel cron: Bearer token
  if (secret && auth === `Bearer ${secret}`) return true;
  // Allow if no secret is configured (dev mode)
  if (!secret) return true;
  return false;
}

export async function GET(req: Request) {
  return POST(req);
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  console.log('[cron/bootstrap] Starting 7-day bootstrap...');

  try {
    const countries = await fetchAndStoreCountries();
    const leagues = await fetchAndStoreLeagues(TOP_LEAGUES);
    const fixtures = await fetchAndStoreFixturesForWindow();

    const duration = Date.now() - start;
    console.log('[cron/bootstrap] Done:', { countries, leagues, fixtures, durationMs: duration });

    return NextResponse.json({
      ok: true,
      countries,
      leagues,
      fixtures,
      durationMs: duration,
    });
  } catch (err: any) {
    console.error('[cron/bootstrap] Failed:', err);
    return NextResponse.json({ error: err.message || 'Bootstrap failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
