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

    // Fetch fixtures (team names/logos) and odds (1x2 odds) in parallel — 2 API calls
    const [fixturesPage, oddsPage] = await Promise.all([
      apiFetch('/fixtures', { date: today }),
      apiFetch('/odds', { date: today, page: 1, bet: 1 }),
    ]);

    if (!oddsPage || oddsPage.length === 0) {
      console.log('[sync] No odds available for today.');
      return NextResponse.json({ ok: true, message: 'No odds today', fixturesStored: 0 });
    }

    console.log(`[sync] Got ${fixturesPage.length} fixtures, ${oddsPage.length} odds items`);

    // Build a lookup map of fixture ID → team info from the /fixtures response
    const fixtureInfoMap = new Map<number, { 
      home_name: string; home_logo: string | null; home_id: number;
      away_name: string; away_logo: string | null; away_id: number;
      league_name: string; league_logo: string | null; country: string; league_id: number;
      venue_name: string | null; venue_city: string | null; referee: string | null;
    }>();

    for (const f of fixturesPage) {
      const id = f?.fixture?.id;
      if (!id) continue;
      fixtureInfoMap.set(id, {
        home_name: f.teams?.home?.name || '',
        home_logo: f.teams?.home?.logo || null,
        home_id: f.teams?.home?.id || 0,
        away_name: f.teams?.away?.name || '',
        away_logo: f.teams?.away?.logo || null,
        away_id: f.teams?.away?.id || 0,
        league_name: f.league?.name || '',
        league_logo: f.league?.logo || null,
        country: f.league?.country || '',
        league_id: f.league?.id || 0,
        venue_name: f.fixture?.venue?.name || null,
        venue_city: f.fixture?.venue?.city || null,
        referee: f.fixture?.referee || null,
      });
    }

    const batch = db.batch();
    let fixturesStored = 0;

    for (const item of oddsPage) {
      // The odds response embeds fixture info (id, date, status) but NOT team names/logos
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

      // Merge team info from the fixtures lookup
      const info = fixtureInfoMap.get(fixture.id);

      const ref = db.collection('fixtures').doc(String(fixture.id));
      batch.set(ref, {
        api_fixture_id: fixture.id,
        match_date: fixture.date || null,
        status: fixture.status?.short || 'NS',
        elapsed: fixture.status?.elapsed || null,
        referee: info?.referee || fixture.referee || null,
        // Team info from /fixtures endpoint
        home_team_id: String(info?.home_id || ''),
        away_team_id: String(info?.away_id || ''),
        home_team_name: info?.home_name || '',
        away_team_name: info?.away_name || '',
        home_team_logo: info?.home_logo || null,
        away_team_logo: info?.away_logo || null,
        home_goals: null,
        away_goals: null,
        // League info — prefer from /fixtures (more complete)
        league_id: String(info?.league_id || league?.id || ''),
        league_name: info?.league_name || league?.name || '',
        league_logo: info?.league_logo || league?.logo || null,
        api_league_id: info?.league_id || league?.id || 0,
        country_name: info?.country || league?.country || null,
        venue_name: info?.venue_name || fixture.venue?.name || null,
        venue_city: info?.venue_city || fixture.venue?.city || null,
        // Odds
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
