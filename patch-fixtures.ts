import 'dotenv/config';
import { db } from './lib/firebase-admin';

const API_KEY = process.env.FOOTBALL_API_KEY || '';
const today = new Date().toISOString().split('T')[0];

async function run() {
  console.log('[patch] Fetching fixtures for', today);

  // Get existing fixture IDs from Firestore
  const snap = await db.collection('fixtures').get();
  const existingIds = new Set(snap.docs.map(d => d.id));
  console.log('[patch] Found', existingIds.size, 'existing fixtures in Firestore');

  // Fetch team info from the /fixtures API
  const res = await fetch(`https://v3.football.api-sports.io/fixtures?date=${today}`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  const json = await res.json();
  const fixtures = json?.response ?? [];
  console.log('[patch] Got', fixtures.length, 'fixtures from API');

  // Fetch odds to know which fixtures have odds today
  const oddsRes = await fetch(`https://v3.football.api-sports.io/odds?date=${today}&page=1&bet=1`, {
    headers: { 'x-apisports-key': API_KEY },
  });
  const oddsJson = await oddsRes.json();
  const oddsItems = oddsJson?.response ?? [];
  console.log('[patch] Got', oddsItems.length, 'odds items from API');

  // Build odds map
  const oddsMap = new Map<number, { home: number | null; draw: number | null; away: number | null }>();
  for (const item of oddsItems) {
    const fid = item?.fixture?.id;
    if (!fid) continue;
    let homeOdd: number | null = null;
    let drawOdd: number | null = null;
    let awayOdd: number | null = null;
    outer: for (const bm of item?.bookmakers ?? []) {
      for (const bet of bm?.bets ?? []) {
        if (bet?.id !== 1) continue;
        for (const v of bet?.values ?? []) {
          if (v.value === 'Home' && !homeOdd) homeOdd = parseFloat(v.odd) || null;
          if (v.value === 'Draw' && !drawOdd) drawOdd = parseFloat(v.odd) || null;
          if (v.value === 'Away' && !awayOdd) awayOdd = parseFloat(v.odd) || null;
        }
        if (homeOdd && drawOdd && awayOdd) break outer;
      }
    }
    oddsMap.set(fid, { home: homeOdd, draw: drawOdd, away: awayOdd });
  }

  // Write all fixtures with team info + odds
  const batch = db.batch();
  let count = 0;

  for (const f of fixtures) {
    const id = f?.fixture?.id;
    if (!id) continue;
    const odds = oddsMap.get(id);
    if (!odds) continue; // Only store fixtures that have odds

    const ref = db.collection('fixtures').doc(String(id));
    batch.set(ref, {
      api_fixture_id: id,
      match_date: f.fixture?.date || null,
      status: f.fixture?.status?.short || 'NS',
      elapsed: f.fixture?.status?.elapsed || null,
      referee: f.fixture?.referee || null,
      home_team_id: String(f.teams?.home?.id || ''),
      away_team_id: String(f.teams?.away?.id || ''),
      home_team_name: f.teams?.home?.name || '',
      away_team_name: f.teams?.away?.name || '',
      home_team_logo: f.teams?.home?.logo || null,
      away_team_logo: f.teams?.away?.logo || null,
      home_goals: f.goals?.home ?? null,
      away_goals: f.goals?.away ?? null,
      league_id: String(f.league?.id || ''),
      league_name: f.league?.name || '',
      league_logo: f.league?.logo || null,
      api_league_id: f.league?.id || 0,
      country_name: f.league?.country || null,
      venue_name: f.fixture?.venue?.name || null,
      venue_city: f.fixture?.venue?.city || null,
      home_odds: odds.home,
      draw_odds: odds.draw,
      away_odds: odds.away,
      has_odds: true,
      updated_at: new Date().toISOString(),
    }, { merge: true });

    count++;
    if (count % 400 === 0) {
      await batch.commit();
      console.log('[patch] Committed', count, 'so far...');
    }
  }

  if (count % 400 !== 0) {
    await batch.commit();
  }

  console.log('[patch] Done! Stored', count, 'fixtures with team info + odds');
}

run().catch(console.error).finally(() => process.exit(0));
