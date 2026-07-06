/**
 * /api/cron/sync
 *
 * Syncs LIVE match scores and live in-play odds from API-Football.
 * Should run every 1 minute while matches are happening, or every 5 minutes otherwise.
 *
 * Budget: 2 API requests per run.
 * Schedule: "* * * * *" (every minute) in vercel.json
 */
import { NextResponse } from 'next/server';
import { syncLiveMatches } from '@/lib/services/apiFootball';

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET || '';
  const auth = req.headers.get('authorization');
  if (secret && auth === `Bearer ${secret}`) return true;
  if (!secret) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();

  try {
    const result = await syncLiveMatches();
    const duration = Date.now() - start;

    return NextResponse.json({
      message: result.liveCount > 0 ? 'Live sync completed' : 'No live matches at this time',
      ...result,
      durationMs: duration,
    });
  } catch (err: any) {
    console.error('[cron/sync] Error:', err);
    return NextResponse.json({ message: 'Sync failed', error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
