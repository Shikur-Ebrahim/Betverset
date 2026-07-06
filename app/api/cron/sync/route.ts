import { NextResponse } from 'next/server';
import {
  fetchAndStoreCountries,
  fetchAndStoreLeagues,
  fetchAndStoreFixturesForWindow,
  TOP_LEAGUES,
} from '@/lib/services/apiFootball';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();

    await fetchAndStoreCountries();
    await fetchAndStoreLeagues(TOP_LEAGUES);
    const { fixturesSeen } = await fetchAndStoreFixturesForWindow();

    const duration = Date.now() - startTime;
    return NextResponse.json({
      message: 'Sync completed',
      fixturesUpdated: fixturesSeen,
      durationMs: duration
    });
  } catch (err: any) {
    console.error('CRON Sync Error:', err);
    return NextResponse.json({ message: 'Sync failed', error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
