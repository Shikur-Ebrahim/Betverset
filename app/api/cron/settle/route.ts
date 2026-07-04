import { NextResponse } from 'next/server';
import { settleFinishedBets } from '@/lib/services/apiFootball';


const CRON_SECRET = process.env.CRON_SECRET || '';

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization');
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) return true;
  if (!CRON_SECRET) return true;
  return false;
}

// POST /api/cron/settle — settle won/lost bet slips
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[cron/settle] Starting bet settlement...');
    const result = await settleFinishedBets();
    console.log('[cron/settle] Done:', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[cron/settle] Failed:', err);
    return NextResponse.json({ error: err.message || 'Settlement failed' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}

export const dynamic = 'force-dynamic';

export const maxDuration = 300;
