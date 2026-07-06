/**
 * /api/cron/settle
 *
 * Settles bets by checking finished match results in the Supabase DB.
 * Uses ZERO API requests — reads from DB only.
 * Also handles manual ticket auto-win resolution.
 *
 * Budget: 0 API requests per run.
 * Schedule: every 5 minutes in vercel.json
 */
import { NextResponse } from 'next/server';
import { settleFinishedBets } from '@/lib/services/apiFootball';

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
    const result = await settleFinishedBets();
    return NextResponse.json({
      message: `Settled ${result.settled} bet slips`,
      ...result,
    });
  } catch (err: any) {
    console.error('[cron/settle] Error:', err);
    return NextResponse.json({ message: 'Settlement failed', error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
