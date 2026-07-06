/**
 * apiFootball service - fetches from API-Football and writes to Supabase PostgreSQL.
 */
import { supabaseAdmin } from '@/lib/supabase-admin';

const API_HOST = process.env.API_FOOTBALL_HOST || 'v3.football.api-sports.io';
const API_BASE = `https://${API_HOST}`;
const API_KEY = process.env.FOOTBALL_API_KEY || '';
const DAILY_LIMIT = 7500;

// In-memory quota cache to avoid blocking DB reads on every API call
let quotaCache: { date: string; count: number } = { date: '', count: 0 };

async function checkAndIncrementQuota(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  
  if (quotaCache.date !== today) {
    quotaCache = { date: today, count: 0 };
  }
  
  quotaCache.count++;
  
  if (quotaCache.count > DAILY_LIMIT) {
    throw new Error(`API-Football daily limit reached (${DAILY_LIMIT}). Wait for tomorrow.`);
  }
  
  // Fire-and-forget DB update
  ;(async () => {
    try {
      await supabaseAdmin.from('app_settings').upsert(
        { key: 'api_quota', value: { date: today, requests_today: quotaCache.count, limit: DAILY_LIMIT } },
        { onConflict: 'key' }
      );
    } catch (e) {}
  })();
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

export async function fetchAndStoreCountries() {
  const data = await apiFetch('/countries');
  await supabaseAdmin.from('app_settings').upsert(
    { key: 'countries_cache', value: data },
    { onConflict: 'key' }
  );
  return { countriesSeen: data.length };
}

export async function fetchAndStoreLeagues(leagueIds?: number[]) {
  const data = await apiFetch('/leagues');
  const records: any[] = [];

  for (const item of data) {
    const l = item?.league;
    const c = item?.country;
    const seasons: any[] = item?.seasons ?? [];
    if (!l?.id) continue;
    if (leagueIds && !leagueIds.includes(l.id)) continue;

    const currentSeason = seasons.find((s: any) => s.current)?.year ?? null;
    records.push({
      id: l.id,
      api_league_id: l.id,
      name: l.name || '',
      type: l.type || '',
      logo: l.logo || null,
      country: c?.name || null,
      country_name: c?.name || null,
      country_code: c?.code || null,
      flag_url: c?.flag || null,
      season_current: currentSeason ? String(currentSeason) : null,
      is_top: leagueIds ? leagueIds.includes(l.id) : false,
      top_rank: leagueIds ? leagueIds.indexOf(l.id) : null,
      updated_at: new Date().toISOString(),
    });
  }

  if (records.length > 0) {
    // batch in chunks of 100
    for (let i = 0; i < records.length; i += 100) {
      await supabaseAdmin.from('leagues').upsert(records.slice(i, i + 100), { onConflict: 'id' });
    }
  }
  return { leaguesSeen: data.length, stored: records.length };
}

export async function storeOddsFromData(fixtureId: number, oddsItems: any[]): Promise<number> {
  const records: any[] = [];
  for (const item of oddsItems) {
    const bookmakers: any[] = item?.bookmakers ?? [];
    for (const bookmaker of bookmakers) {
      if (!bookmaker?.id) continue;
      for (const bet of bookmaker?.bets ?? []) {
        for (const value of bet?.values ?? []) {
          const oddId = `${fixtureId}_${bookmaker.id}_${bet.id}_${value.value}`.replace(/\//g, '-').replace(/\s+/g, '_');
          records.push({
            id: oddId,
            fixture_id: fixtureId,
            bookmaker_id: String(bookmaker.id),
            bookmaker_name: bookmaker.name || '',
            market_id: String(bet.id),
            market_name: bet.name || '',
            market_key: bet.name?.toLowerCase().replace(/\s+/g, '_') || '',
            selection: value.value || '',
            odd_value: parseFloat(value.odd) || null,
            last_update: new Date().toISOString(),
            markets: { bookmaker, bet, value },
            updated_at: new Date().toISOString(),
          });
        }
      }
    }
  }

  for (let i = 0; i < records.length; i += 100) {
    await supabaseAdmin.from('odds').upsert(records.slice(i, i + 100), { onConflict: 'id' });
  }
  return records.length;
}

export async function fetchAndStoreFixturesForWindow() {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`[sync] Fetching odds page 1 for date ${today}...`);

    const oddsPage = await apiFetch('/odds', { date: today, page: 1 });
    if (!oddsPage || oddsPage.length === 0) {
      console.log('[sync] No odds available for today. Skipping.');
      return { fixturesSeen: 0 };
    }

    console.log(`[sync] Got ${oddsPage.length} fixtures with odds. Processing...`);

    const oddsMap = new Map<number, any[]>();
    for (const item of oddsPage) {
      const fid: number = item?.fixture?.id;
      if (!fid) continue;
      oddsMap.set(fid, [item]);
    }

    const allIds = Array.from(oddsMap.keys()).slice(0, 20);
    const fixtureDetails = await apiFetch('/fixtures', { id: allIds.join('-') });

    let fixturesStored = 0;
    const fixtureRecords: any[] = [];

    for (const item of fixtureDetails) {
      const f = item?.fixture;
      const teams = item?.teams;
      const league = item?.league;
      const goals = item?.goals;
      if (!f?.id) continue;

      const oddsItems = oddsMap.get(f.id) || [];
      if (oddsItems.length === 0) continue;

      fixtureRecords.push({
        id: f.id,
        api_fixture_id: f.id,
        match_date: f.date || null,
        status: f.status?.short || 'NS',
        kickoff_at: f.date || new Date().toISOString(),
        elapsed: f.status?.elapsed || null,
        referee: f.referee || null,
        home_team_id: teams?.home?.id || null,
        away_team_id: teams?.away?.id || null,
        home_team_name: teams?.home?.name || '',
        away_team_name: teams?.away?.name || '',
        home_team_logo: teams?.home?.logo || null,
        away_team_logo: teams?.away?.logo || null,
        home_goals: goals?.home ?? null,
        away_goals: goals?.away ?? null,
        league_id: league?.id || null,
        league_name: league?.name || '',
        league_logo: league?.logo || null,
        api_league_id: league?.id || 0,
        country_name: league?.country || null,
        venue_name: f.venue?.name || null,
        venue_city: f.venue?.city || null,
        data: item,
        updated_at: new Date().toISOString(),
      });

      await storeOddsFromData(f.id, oddsItems);
      fixturesStored++;
    }

    if (fixtureRecords.length > 0) {
      await supabaseAdmin.from('fixtures').upsert(fixtureRecords, { onConflict: 'id' });
    }

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
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  let finishedFixtureIds = new Set<string>();

  try {
    const { data: finishedFixtures } = await supabaseAdmin
      .from('fixtures')
      .select('id')
      .eq('status', 'FT')
      .gte('updated_at', twoHoursAgo);
      
    if (finishedFixtures && finishedFixtures.length > 0) {
      finishedFixtureIds = new Set(finishedFixtures.map((f: any) => String(f.id)));
    }
  } catch (err) {
    console.error('Failed to query fixtures for settlement:', err);
  }

  let settled = 0;

  const { data: pendingSlips } = await supabaseAdmin
    .from('bet_slips')
    .select('*')
    .eq('status', 'pending');

  for (const slip of (pendingSlips || [])) {
    const selections: any[] = slip.selections || [];
    let allResolved = true;
    let anyLost = false;
    let updatedManual = false;
    const updatedSelections = selections.map(s => ({ ...s }));

    for (const s of updatedSelections) {
      if (s.is_manual || s.manual_end_at) {
        if (s.result !== 'won' && s.result !== 'lost') {
          const ended = new Date(s.manual_end_at).getTime() <= Date.now();
          if (!ended) {
            allResolved = false;
          } else {
            s.result = 'won';
            updatedManual = true;
          }
        }
      } else {
        if (s.result === 'lost') {
          anyLost = true;
        } else if (s.result !== 'won') {
          if (finishedFixtureIds.has(String(s.fixture_id))) {
            allResolved = false;
          } else {
            allResolved = false;
          }
        }
      }
    }

    if (!allResolved) {
      if (updatedManual) {
        await supabaseAdmin.from('bet_slips').update({
          selections: updatedSelections,
          updated_at: new Date().toISOString()
        }).eq('id', slip.id);
      }
      continue;
    }

    const newStatus: string = anyLost ? 'lost' : 'won';

    try {
      await supabaseAdmin.from('bet_slips').update({
        status: newStatus,
        selections: updatedSelections,
        updated_at: new Date().toISOString()
      }).eq('id', slip.id);

      if (newStatus === 'won' && slip.user_id && !slip.paid_out) {
        const { data: userData } = await supabaseAdmin.from('users').select('balance').eq('id', slip.user_id).single();
        if (userData) {
          const currentBalance = Number(userData.balance) || 0;
          await supabaseAdmin.from('users').update({
            balance: currentBalance + Number(slip.possible_win || 0)
          }).eq('id', slip.user_id);
          await supabaseAdmin.from('bet_slips').update({ paid_out: true }).eq('id', slip.id);
        }
      }
      settled++;
    } catch (txErr) {
      console.error(`[settle] Failed to settle ticket ${slip.id}:`, txErr);
    }
  }

  return { settled };
}

export async function purgeOldFinishedFixtures() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: oldFixtures } = await supabaseAdmin
    .from('fixtures')
    .select('id')
    .eq('status', 'FT')
    .lt('match_date', cutoff)
    .limit(50);

  let deletedFixtures = 0;
  let deletedOdds = 0;

  for (const fixture of (oldFixtures || [])) {
    const { data } = await supabaseAdmin
      .from('odds')
      .delete()
      .eq('fixture_id', fixture.id)
      .select('id');
    
    deletedOdds += data?.length || 0;

    await supabaseAdmin.from('fixtures').delete().eq('id', fixture.id);
    deletedFixtures++;
  }
  
  return { deletedFixtures, deletedOdds };
}

export async function getApiQuotaStatus() {
  const { data } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'api_quota').single();
  return data?.value || { requests_today: 0, limit: 7500 };
}
