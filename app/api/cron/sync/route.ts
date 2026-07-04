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

/**
 * Sync fixtures from API-Football to Firestore.
 * Strategy:
 * 1. Fetch odds by date (guarantees matches have odds + gives us odds data)
 * 2. Store fixture metadata + odds bookmaker counts immediately
 * 3. Use minimal Firestore writes — only one doc per fixture (no odds sub-collection in sync)
 * 
 * This is designed to complete in < 10 seconds on Vercel Hobby.
 */
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`[sync] Starting sync for ${today}`);

    // Step 1: Fetch odds for today from API-Football (1 API call)
    // This endpoint returns fixtures WITH their odds in one shot
    const oddsPage = await apiFetch('/odds', { date: today, page: 1 });
    
    if (!oddsPage || oddsPage.length === 0) {
      console.log('[sync] No odds available for today.');
      return NextResponse.json({ ok: true, message: 'No odds today', fixturesStored: 0 });
    }

    console.log(`[sync] Got ${oddsPage.length} fixtures with odds`);

    // Step 2: Build a lookup of fixtureId -> bookmakers data (all in memory)
    const oddsMap = new Map<number, any[]>();
    for (const item of oddsPage) {
      const fid: number = item?.fixture?.id;
      if (!fid) continue;
      oddsMap.set(fid, item?.bookmakers ?? []);
    }

    // Step 3: Fetch fixture details for these IDs (1 API call)
    const allIds = Array.from(oddsMap.keys()).slice(0, 20);
    const fixtureDetails = await apiFetch('/fixtures', { id: allIds.join('-') });

    // Step 4: Save all fixtures in ONE batch commit (very fast)
    const batch = db.batch();
    let fixturesStored = 0;

    for (const item of fixtureDetails) {
      const f = item?.fixture;
      const teams = item?.teams;
      const league = item?.league;
      const goals = item?.goals;
      if (!f?.id) continue;

      const bookmakers = oddsMap.get(f.id) || [];
      if (bookmakers.length === 0) continue;

      // Extract 1x2 (Match Winner) odds for quick display on the home page
      const homeOdds: Record<string, number> = {};
      for (const bm of bookmakers) {
        if (!bm?.id) continue;
        for (const bet of bm?.bets ?? []) {
          if (!bet?.name?.toLowerCase().includes('match winner') && bet?.id !== 1) continue;
          for (const v of bet?.values ?? []) {
            if (!homeOdds[v.value]) homeOdds[v.value] = parseFloat(v.odd) || 0;
          }
        }
      }

      const ref = db.collection('fixtures').doc(String(f.id));
      batch.set(ref, {
        api_fixture_id: f.id,
        match_date: f.date || null,
        status: f.status?.short || 'NS',
        elapsed: f.status?.elapsed || null,
        referee: f.referee || null,
        home_team_id: String(teams?.home?.id || ''),
        away_team_id: String(teams?.away?.id || ''),
        home_team_name: teams?.home?.name || '',
        away_team_name: teams?.away?.name || '',
        home_team_logo: teams?.home?.logo || null,
        away_team_logo: teams?.away?.logo || null,
        home_goals: goals?.home ?? null,
        away_goals: goals?.away ?? null,
        league_id: String(league?.id || ''),
        league_name: league?.name || '',
        league_logo: league?.logo || null,
        api_league_id: league?.id || 0,
        country_name: league?.country || null,
        venue_name: f.venue?.name || null,
        venue_city: f.venue?.city || null,
        // Store basic 1x2 odds directly on the fixture doc for fast home page display
        home_odds: homeOdds['Home'] || homeOdds['1'] || null,
        draw_odds: homeOdds['Draw'] || homeOdds['X'] || null,
        away_odds: homeOdds['Away'] || homeOdds['2'] || null,
        bookmakers_count: bookmakers.length,
        has_odds: true,
        updated_at: new Date().toISOString(),
      }, { merge: true });

      fixturesStored++;
    }

    // ONE commit for all fixtures — very fast
    await batch.commit();

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
