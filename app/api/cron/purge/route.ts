import { NextResponse } from 'next/server';
import { purgeOldFinishedFixtures } from '@/lib/services/apiFootball';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { deletedFixtures, deletedOdds } = await purgeOldFinishedFixtures();
    return NextResponse.json({
      message: 'Purge completed',
      deletedFixtures,
      deletedOdds,
    });
  } catch (err: any) {
    console.error('CRON Purge Error:', err);
    return NextResponse.json({ message: 'Purge failed', error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
