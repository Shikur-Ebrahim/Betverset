import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { fetchAndStoreOddsForFixture, fetchAndStoreFixturesForWindow } from '@/lib/services/apiFootball';

const CRON_SECRET = process.env.CRON_SECRET || '';

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization');
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) return true;
  if (!CRON_SECRET) return true;
  return false;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[cron/sync] Starting routine match and odds sync...');

    // 1. Sync upcoming fixtures to ensure our database knows about new matches
    await fetchAndStoreFixturesForWindow();

    // 2. Find upcoming fixtures (next 48 hours) to fetch odds for
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

    const snapshot = await db.collection('fixtures')
      .where('match_date', '>=', now.toISOString())
      .where('match_date', '<=', twoDaysFromNow)
      .get();

    let oddsFetched = 0;
    
    // We process them sequentially or in small batches to respect limits and avoid API spikes
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const fixtureId = Number(data.api_fixture_id);
      
      if (!fixtureId) continue;

      try {
        const count = await fetchAndStoreOddsForFixture(fixtureId);
        oddsFetched += count;
        
        if (count === 0) {
          await db.collection('fixtures').doc(doc.id).delete();
          console.log(`[cron/sync] Deleted fixture ${fixtureId} because it has no odds.`);
        }
      } catch (err: any) {
        // If we hit our 7500 daily quota limit, break out early
        if (err.message && err.message.includes('daily limit reached')) {
          console.warn('[cron/sync] API Quota reached. Stopping odds sync.');
          break;
        }
        console.error(`[cron/sync] Failed odds for fixture ${fixtureId}:`, err.message);
      }
    }

    console.log(`[cron/sync] Done. Fetched odds for upcoming fixtures: ${oddsFetched} odds stored.`);
    return NextResponse.json({ ok: true, oddsFetched });
  } catch (err: any) {
    console.error('[cron/sync] Failed:', err);
    return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}

export const dynamic = 'force-dynamic';

export const maxDuration = 300;
