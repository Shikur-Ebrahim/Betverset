import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { apiFetch } from '@/lib/services/apiFootball';

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
    const today = new Date().toISOString().split('T')[0];
    console.log(`[sync] Starting sync for ${today}`);

    // ONE API call: /odds?date=today
    // Adding bet=1 restricts the payload to just Match Winner odds, reducing payload size by 99%
    // and drastically speeding up the fetch to avoid Vercel's 10s timeout.
    const oddsPage = await apiFetch('/odds', { date: today, page: 1, bet: 1 });

    if (!oddsPage || oddsPage.length === 0) {
      console.log('[sync] No odds available for today.');
      return NextResponse.json({ ok: true, message: 'No odds today', fixturesStored: 0 });
    }

    console.log(`[sync] Got ${oddsPage.length} items from odds API`);

    const batch = db.batch();
    let fixturesStored = 0;

    for (const item of oddsPage.slice(0, 20)) {
      // The odds response embeds fixture info directly
      const fixture = item?.fixture;
      const league = item?.league;
      const bookmakers: any[] = item?.bookmakers ?? [];

      if (!fixture?.id) continue;
      if (bookmakers.length === 0) continue;

      // Extract 1x2 (Match Winner) odds — Bet ID 1 on API-Football
      let homeOdd: number | null = null;
      let drawOdd: number | null = null;
      let awayOdd: number | null = null;

      outer: for (const bm of bookmakers) {
        for (const bet of bm?.bets ?? []) {
          if (bet?.id !== 1 && !bet?.name?.toLowerCase().includes('match winner')) continue;
          for (const v of bet?.values ?? []) {
            if (v.value === 'Home' && !homeOdd) homeOdd = parseFloat(v.odd) || null;
            if (v.value === 'Draw' && !drawOdd) drawOdd = parseFloat(v.odd) || null;
            if (v.value === 'Away' && !awayOdd) awayOdd = parseFloat(v.odd) || null;
          }
          if (homeOdd && drawOdd && awayOdd) break outer;
        }
      }

      const ref = db.collection('fixtures').doc(String(fixture.id));
      batch.set(ref, {
        api_fixture_id: fixture.id,
        match_date: fixture.date || null,
        status: fixture.status?.short || 'NS',
        elapsed: fixture.status?.elapsed || null,
        referee: fixture.referee || null,
        home_team_id: String(fixture.teams?.home?.id || ''),
        away_team_id: String(fixture.teams?.away?.id || ''),
        home_team_name: fixture.teams?.home?.name || '',
        away_team_name: fixture.teams?.away?.name || '',
        home_team_logo: fixture.teams?.home?.logo || null,
        away_team_logo: fixture.teams?.away?.logo || null,
        home_goals: null,
        away_goals: null,
        league_id: String(league?.id || ''),
        league_name: league?.name || '',
        league_logo: league?.logo || null,
        api_league_id: league?.id || 0,
        country_name: league?.country || null,
        venue_name: fixture.venue?.name || null,
        venue_city: fixture.venue?.city || null,
        home_odds: homeOdd,
        draw_odds: drawOdd,
        away_odds: awayOdd,
        bookmakers_count: bookmakers.length,
        has_odds: true,
        updated_at: new Date().toISOString(),
      }, { merge: true });

      fixturesStored++;
    }

    if (fixturesStored > 0) {
      await batch.commit();
    }

    console.log(`[sync] Stored ${fixturesStored} fixtures.`);
    return NextResponse.json({ ok: true, fixturesStored });
  } catch (err: any) {
    console.error('[sync] Failed:', err);
    return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}

export const dynamic = 'force-dynamic';
