/**
 * /api/cron/purge
 *
 * Deletes finished matches, fixtures without odds, and enforces 350 max total.
 *
 * Budget: 0 API requests per run.
 * Schedule: "0 2 * * *" (2 AM UTC daily) in vercel.json
 */
import { NextResponse } from 'next/server';
import { purgeOldFinishedFixtures } from '@/lib/services/apiFootball';

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

  try {
    const result = await purgeOldFinishedFixtures();
    return NextResponse.json({
      message: 'Purge completed',
      ...result,
    });
  } catch (err: any) {
    console.error('[cron/purge] Error:', err);
    return NextResponse.json({ message: 'Purge failed', error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
