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

// In-memory quota cache to avoid blocking Firestore reads on every API call
let quotaCache: { date: string; count: number } = { date: '', count: 0 };

async function checkAndIncrementQuota(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  
  // Reset cache on new day
  if (quotaCache.date !== today) {
    quotaCache = { date: today, count: 0 };
  }
  
  quotaCache.count++;
  
  if (quotaCache.count > DAILY_LIMIT) {
    throw new Error(`API-Football daily limit reached (${DAILY_LIMIT}). Wait for tomorrow.`);
  }
  
  // Fire-and-forget Firestore update — don't block the API call on this
  const ref = db.collection('app_settings').doc('api_quota');
  ref.set({ date: today, requests_today: quotaCache.count, limit: DAILY_LIMIT }, { merge: true })
    .catch(() => {}); // Silently ignore Firestore write errors
}

export async function apiFetch(endpoint: string, params: Record<string, string | number> = {}) {
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

// Helper: store odds from already-fetched data (no extra API call)
export async function storeOddsFromData(fixtureId: number, oddsItems: any[]): Promise<number> {
  const batch = db.batch();
  let count = 0;
  for (const item of oddsItems) {
    const bookmakers: any[] = item?.bookmakers ?? [];
    for (const bookmaker of bookmakers) {
      if (!bookmaker?.id) continue;
      for (const bet of bookmaker?.bets ?? []) {
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
  if (count % 400 !== 0) await batch.commit();
  return count;
}

export async function fetchAndStoreFixturesForWindow() {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`[sync] Fetching odds page 1 for date ${today}...`);

    // Step 1: Fetch odds by date - this guarantees matches have odds
    const oddsPage = await apiFetch('/odds', { date: today, page: 1 });
    if (!oddsPage || oddsPage.length === 0) {
      console.log('[sync] No odds available for today. Skipping.');
      return { fixturesSeen: 0 };
    }

    console.log(`[sync] Got ${oddsPage.length} fixtures with odds. Processing...`);

    // Step 2: Build a map of fixtureId -> odds items (already in memory)
    const oddsMap = new Map<number, any[]>();
    for (const item of oddsPage) {
      const fid: number = item?.fixture?.id;
      if (!fid) continue;
      oddsMap.set(fid, [item]);
    }

    // Step 3: Fetch fixture details for up to 20 at a time
    const allIds = Array.from(oddsMap.keys()).slice(0, 20);
    const fixtureDetails = await apiFetch('/fixtures', { id: allIds.join('-') });

    let fixturesStored = 0;
    const batch = db.batch();

    for (const item of fixtureDetails) {
      const f = item?.fixture;
      const teams = item?.teams;
      const league = item?.league;
      const goals = item?.goals;
      if (!f?.id) continue;

      const oddsItems = oddsMap.get(f.id) || [];
      if (oddsItems.length === 0) continue;

      // Save fixture
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

      // Save odds from memory (no extra API call)
      await storeOddsFromData(f.id, oddsItems);
      fixturesStored++;
    }

    await batch.commit();
    console.log(`[sync] Stored ${fixturesStored} fixtures with odds.`);
    return { fixturesSeen: fixturesStored };
  } catch (err) {
    console.error(`[sync] Failed to sync fixtures:`, err);
    return { fixturesSeen: 0 };
  }
}

export async function fetchAndStoreOddsForFixture(fixtureId: number) {
  const data = await apiFetch('/odds', { fixture: fixtureId });
  if (!data.length) return 0;
  return storeOddsFromData(fixtureId, data);
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

    let allResolved = true;
    let anyLost = false;
    let updatedManual = false;

    for (const s of selections) {
      if (s.is_manual || s.manual_end_at) {
        // Manual match: check if end time has passed
        if (s.result !== 'won' && s.result !== 'lost') {
          const ended = new Date(s.manual_end_at).getTime() <= Date.now();
          if (!ended) {
            allResolved = false;
          } else {
            // If ended, it's an automatic win
            s.result = 'won';
            updatedManual = true;
          }
        }
      } else {
        // Real match
        if (s.result === 'lost') {
          anyLost = true;
        } else if (s.result === 'won') {
          // already resolved
        } else if (finishedFixtureIds.has(String(s.fixture_id))) {
          if (s.result !== 'won' && s.result !== 'lost') {
            allResolved = false; 
          }
        } else {
          allResolved = false;
        }
      }
    }

    if (!allResolved) {
      // Save partial progress if any manual legs were just marked won
      if (updatedManual) {
        await slipDoc.ref.update({ selections, updated_at: new Date().toISOString() });
      }
      continue;
    }

    const newStatus: string = anyLost ? 'lost' : 'won';

    try {
      await db.runTransaction(async (tx: any) => {
        let userDoc = null;
        let userRef = null;

        if (newStatus === 'won' && slip.user_id) {
          userRef = db.collection('users').doc(String(slip.user_id));
          userDoc = await tx.get(userRef);
        }

        tx.update(slipDoc.ref, { status: newStatus, selections, updated_at: new Date().toISOString() });
        
        if (userDoc?.exists && userRef) {
          const currentBalance = Number(userDoc.data()?.balance) || 0;
          tx.update(userRef, { balance: currentBalance + Number(slip.possible_win || 0) });
        }
      });
      settled++;
    } catch (txErr) {
      console.error(`[sync] Failed to settle ticket ${slipDoc.id}:`, txErr);
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
