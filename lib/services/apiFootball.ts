/**
 * apiFootball service - fetches from API-Football and writes to Firestore.
 * This replaces the PostgreSQL-based backend syncService.
 */
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const API_HOST = process.env.API_FOOTBALL_HOST || 'v3.football.api-sports.io';
const API_BASE = `https://${API_HOST}`;
const API_KEY = process.env.FOOTBALL_API_KEY || '';
const DAILY_LIMIT = 7500;

async function checkAndIncrementQuota(): Promise<void> {
  const ref = db.collection('app_settings').doc('api_quota');
  const today = new Date().toISOString().slice(0, 10);
  
  const doc = await ref.get();
  const data = doc.data();

  if (!doc.exists || data?.date !== today) {
    await ref.set({ date: today, requests_today: 1, limit: DAILY_LIMIT });
    return;
  }

  if (data.requests_today >= DAILY_LIMIT) {
    throw new Error(`API-Football daily limit reached (${DAILY_LIMIT}). Wait for tomorrow.`);
  }

  await ref.update({ requests_today: FieldValue.increment(1), limit: DAILY_LIMIT });
}

async function apiFetch(endpoint: string, params: Record<string, string | number> = {}) {
  await checkAndIncrementQuota();

  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), {
    headers: { 'x-apisports-key': API_KEY },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`API-Football error ${res.status}: ${endpoint}`);
  const json = await res.json();
  return json?.response ?? [];
}

export const TOP_LEAGUES = [39, 2, 140, 135, 78, 61, 3, 848, 45, 40, 307, 253, 71, 88, 94];

function getFixtureWindowRange() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  const end = new Date(now);
  end.setDate(end.getDate() + 7);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function fetchAndStoreCountries() {
  const data = await apiFetch('/countries');
  const batch = db.batch();
  let count = 0;

  for (const item of data) {
    if (!item?.name) continue;
    const id = item.name.toLowerCase().replace(/\s+/g, '_');
    const ref = db.collection('countries').doc(id);
    batch.set(ref, {
      name: item.name,
      code: item.code || null,
      flag_url: item.flag || null,
      updated_at: new Date().toISOString(),
    }, { merge: true });
    count++;
    if (count % 400 === 0) await batch.commit();
  }
  await batch.commit();
  return { countriesSeen: data.length };
}

export async function fetchAndStoreLeagues(leagueIds?: number[]) {
  const params: Record<string, string | number> = {};
  const data = await apiFetch('/leagues', params);
  const batch = db.batch();
  let count = 0;
  let stored = 0;

  for (const item of data) {
    const l = item?.league;
    const c = item?.country;
    const seasons: any[] = item?.seasons ?? [];
    if (!l?.id) continue;
    if (leagueIds && !leagueIds.includes(l.id)) continue;

    const currentSeason = seasons.find((s: any) => s.current)?.year ?? null;
    const ref = db.collection('leagues').doc(String(l.id));
    batch.set(ref, {
      api_league_id: l.id,
      name: l.name || '',
      type: l.type || '',
      logo: l.logo || null,
      country_name: c?.name || null,
      country_code: c?.code || null,
      flag_url: c?.flag || null,
      season_current: currentSeason ? String(currentSeason) : null,
      is_top: leagueIds ? leagueIds.includes(l.id) : false,
      top_rank: leagueIds ? leagueIds.indexOf(l.id) : null,
      updated_at: new Date().toISOString(),
    }, { merge: true });
    stored++;
    count++;
    if (count % 400 === 0) await batch.commit();
  }
  await batch.commit();
  return { leaguesSeen: data.length, stored };
}

export async function fetchAndStoreFixturesForWindow(season?: number) {
  // We fetch the next 50 upcoming fixtures globally to guarantee matches are always available
  // Fetch all fixtures for today to guarantee we hit active summer leagues with odds
  try {
    const data = await apiFetch('/fixtures', { next: 50 });
    const batch = db.batch();
    let count = 0;
    let total = 0;

    for (const item of data) {
      const f = item?.fixture;
      const teams = item?.teams;
      const league = item?.league;
      const goals = item?.goals;
      if (!f?.id) continue;

      try {
        // 1. Fetch Odds FIRST before saving the match
        const oddsCount = await fetchAndStoreOddsForFixture(f.id);
        
        // 2. Only save the match if it actually has odds!
        if (oddsCount > 0) {
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
            updated_at: new Date().toISOString(),
          }, { merge: true });
          
          count++;
          total++;
          if (count % 100 === 0) await batch.commit();
        }
      } catch (err: any) {
        if (err.message && err.message.includes('daily limit reached')) {
          console.warn(`[sync] Quota hit while verifying odds. Stopping.`);
          break; // Stop iterating fixtures if quota is hit
        }
        console.error(`[sync] Failed odds verification for fixture ${f.id}:`, err.message);
      }
    }
    await batch.commit();
    return { fixturesSeen: total };
  } catch (err) {
    console.error(`[sync] Failed to sync fixtures:`, err);
    return { fixturesSeen: 0 };
  }
}

export async function fetchAndStoreOddsForFixture(fixtureId: number) {
  const data = await apiFetch('/odds', { fixture: fixtureId });
  if (!data.length) return 0;

  const batch = db.batch();
  let count = 0;

  for (const item of data) {
    const bookmakers: any[] = item?.bookmakers ?? [];
    
    for (const bookmaker of bookmakers) {
      if (!bookmaker?.id) continue;
      const bets: any[] = bookmaker?.bets ?? [];

      for (const bet of bets) {
        for (const value of bet?.values ?? []) {
          const oddId = `${fixtureId}_${bookmaker.id}_${bet.id}_${value.value}`.replace(/\//g, '-').replace(/\s+/g, '_');
          const ref = db.collection('odds').doc(oddId);
          batch.set(ref, {
            fixture_id: String(fixtureId),
            bookmaker_id: String(bookmaker.id),
            bookmaker_name: bookmaker.name || '',
            market_id: String(bet.id),
            market_name: bet.name || '',
            market_key: bet.name?.toLowerCase().replace(/\s+/g, '_') || '',
            selection: value.value || '',
            odd_value: parseFloat(value.odd) || null,
            last_update: new Date().toISOString(),
          }, { merge: true });
          count++;
          if (count % 400 === 0) await batch.commit();
        }
      }
    }
  }
  await batch.commit();
  return count;
}

export async function settleFinishedBets() {
  // Get recently finished fixtures
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const snapshot = await db.collection('fixtures')
    .where('status', '==', 'FT')
    .where('updated_at', '>=', twoHoursAgo)
    .get();

  if (snapshot.empty) return { settled: 0 };

  const finishedFixtureIds = new Set(snapshot.docs.map(d => d.id));
  let settled = 0;

  // Find pending bet slips with selections on these fixtures
  const slipsSnap = await db.collection('bet_slips').where('status', '==', 'pending').get();

  for (const slipDoc of slipsSnap.docs) {
    const slip = slipDoc.data();
    const selections: any[] = slip.selections || [];

    // Check if all selections reference finished fixtures
    const allResolved = selections.every((s: any) => {
      if (!s.fixture_id) return s.result !== null; // manual — already resolved
      return finishedFixtureIds.has(String(s.fixture_id));
    });

    if (!allResolved) continue;

    // All won = 'won', any lost = 'lost'
    const allWon = selections.every((s: any) => s.result === 'won');
    const anyLost = selections.some((s: any) => s.result === 'lost');
    const newStatus = allWon ? 'won' : anyLost ? 'lost' : 'pending';

    if (newStatus !== 'pending') {
      await db.runTransaction(async (tx: any) => {
        tx.update(slipDoc.ref, { status: newStatus, updated_at: new Date().toISOString() });
        if (newStatus === 'won') {
          const userRef = db.collection('users').doc(String(slip.user_id));
          const userDoc = await tx.get(userRef);
          const currentBalance = Number(userDoc.data()?.balance) || 0;
          tx.update(userRef, { balance: currentBalance + Number(slip.possible_win) });
        }
      });
      settled++;
    }
  }

  return { settled };
}

export async function purgeOldFinishedFixtures() {
  // Purge FT fixtures older than 48 hours
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const snapshot = await db.collection('fixtures')
    .where('status', '==', 'FT')
    .where('match_date', '<', cutoff)
    .limit(200)
    .get();

  let deleted = 0;
  const batch = db.batch();
  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    deleted++;
  }
  if (deleted) await batch.commit();
  return { deleted };
}

export async function getApiQuotaStatus() {
  const doc = await db.collection('app_settings').doc('api_quota').get();
  return doc.exists ? doc.data() : { requests_today: 0, limit: 7500 };
}
