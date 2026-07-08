/**
 * apiFootball service — Optimized for 7,500 requests/day quota.
 *
 * Quota Budget Plan:
 *  - Bootstrap (daily, once):   ~7 days * ~10 pages of odds = ~80 requests
 *  - Live sync (every minute):  2 requests/run * 60min * 24h = 2,880 requests
 *  - Settlement check (every 5min): 0 API requests (reads DB only)
 *  - Total: ~3,000 requests/day — well under the 7,500 limit.
 *
 * All user-facing endpoints read from Supabase ONLY.
 * API-Football is only called from cron jobs.
 */
import { supabaseAdmin } from '@/lib/supabase-admin';
import { loadFixtureIdsWithDisplayOdds, oddsRowHasMatchWinner } from '@/lib/load-fixture-odds';
import { siteDayBuckets, siteDayUtcRange, siteWindowRange, toSiteDateStr } from '@/lib/fixture-date-utils';

const API_HOST = process.env.API_FOOTBALL_HOST || 'v3.football.api-sports.io';
const API_BASE = `https://${API_HOST}`;
const API_KEY = process.env.FOOTBALL_API_KEY || '';
const DAILY_LIMIT = 7400; // leave 100 buffer

// In-memory quota cache (resets on cold start, but syncs to DB)
let quotaCache: { date: string; count: number } = { date: '', count: 0 };

async function checkAndIncrementQuota(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  if (quotaCache.date !== today) {
    // Try to restore count from DB on new day
    try {
      const { data } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'api_quota')
        .single();
      if (data?.value?.date === today) {
        quotaCache = { date: today, count: data.value.requests_today || 0 };
      } else {
        quotaCache = { date: today, count: 0 };
      }
    } catch {
      quotaCache = { date: today, count: 0 };
    }
  }

  quotaCache.count++;

  if (quotaCache.count > DAILY_LIMIT) {
    throw new Error(`API-Football daily limit (${DAILY_LIMIT}) reached. Skipping API call to preserve quota.`);
  }

  // Fire-and-forget DB update
  ;(async () => {
    try {
      await supabaseAdmin.from('app_settings').upsert(
        { key: 'api_quota', value: { date: today, requests_today: quotaCache.count, limit: 7500 } },
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
    cache: 'no-store',
  });

  if (!res.ok) {
    console.error(`[apiFetch] HTTP ${res.status} for ${endpoint}`);
    throw new Error(`API-Football error ${res.status}: ${endpoint}`);
  }

  const json = await res.json();
  const remaining = json?.parameters?.remaining ?? json?.results;
  console.log(`[apiFetch] ${endpoint} | quota_used=${quotaCache.count} | api_remaining=${remaining}`);
  return json?.response ?? [];
}

export const TOP_LEAGUES = [39, 2, 140, 135, 78, 61, 3, 848, 45, 40, 307, 253, 71, 88, 94];

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

export function buildFixtureRecord(item: any): any {
  const f = item?.fixture;
  const teams = item?.teams;
  const league = item?.league;
  const goals = item?.goals;
  const score = item?.score;
  if (!f?.id) return null;

  return {
    id: f.id,
    api_fixture_id: f.id,
    match_date: f.date || null,
    kickoff_at: f.date || null,
    status: f.status?.short || 'NS',
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
    flag_url: null,
    venue_name: f.venue?.name || null,
    venue_city: f.venue?.city || null,
    score_halftime_home: score?.halftime?.home ?? null,
    score_halftime_away: score?.halftime?.away ?? null,
    data: item,
    updated_at: new Date().toISOString(),
  };
}

export async function storeOddsFromData(fixtureId: number, oddsItems: any[]): Promise<number> {
  const records: any[] = [];
  for (const item of oddsItems) {
    const bookmakers: any[] = item?.bookmakers ?? [];
    for (const bookmaker of bookmakers) {
      if (!bookmaker?.id) continue;
      for (const bet of bookmaker?.bets ?? []) {
        for (const value of bet?.values ?? []) {
          const oddId = `${fixtureId}_${bookmaker.id}_${bet.id}_${value.value}`
            .replace(/\//g, '-')
            .replace(/\s+/g, '_');
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

  for (let i = 0; i < records.length; i += 200) {
    await supabaseAdmin.from('odds').upsert(records.slice(i, i + 200), { onConflict: 'id' });
  }
  return records.length;
}

// ──────────────────────────────────────────────
// BOOTSTRAP: 7-day schedule + pre-match odds
// Budget: ~80 requests per day run
// ──────────────────────────────────────────────

export async function fetchAndStoreCountries() {
  const data = await apiFetch('/countries');
  await supabaseAdmin.from('app_settings').upsert(
    { key: 'countries_cache', value: data },
    { onConflict: 'key' }
  );
  return { countriesSeen: data.length };
}

export async function fetchAndStoreLeagues(leagueIds?: number[]) {
  const data = await apiFetch('/leagues', { current: 'true' });
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

  for (let i = 0; i < records.length; i += 100) {
    await supabaseAdmin.from('leagues').upsert(records.slice(i, i + 100), { onConflict: 'id' });
  }
  return { leaguesSeen: data.length, stored: records.length };
}

export const MATCHES_PER_DAY = 50;
export const DAYS_AHEAD = 7;
export const MAX_TOTAL_MATCHES = 350;

export function buildCompactOddsRecord(fixtureId: number, oddsItem: any) {
  const bookmakers: any[] = oddsItem?.bookmakers ?? [];
  const markets: any[] = [];

  for (const bookmaker of bookmakers) {
    if (!bookmaker?.id) continue;
    for (const bet of bookmaker?.bets ?? []) {
      const marketKey = (bet.name || '').toLowerCase().replace(/\s+/g, '_');
      const values = (bet?.values ?? [])
        .map((v: any) => ({
          selection: String(v.value || ''),
          odd: parseFloat(v.odd) || null,
        }))
        .filter((v: any) => v.odd && v.odd > 0);

      if (values.length > 0) {
        markets.push({
          market_id: String(bet.id),
          market_name: bet.name || '',
          market_key: marketKey,
          bookmaker_id: String(bookmaker.id),
          bookmaker_name: bookmaker.name || '',
          values,
        });
      }
    }
  }

  return {
    id: `fixture_${fixtureId}_all_odds`,
    fixture_id: fixtureId,
    bookmaker_id: 'all',
    bookmaker_name: 'All',
    market_id: 'all',
    market_name: 'All Markets',
    market_key: 'all_markets',
    selection: 'all',
    odd_value: null,
    markets: { bookmakers, flat_markets: markets },
    updated_at: new Date().toISOString(),
  };
}

async function clearScheduledFixturesForDate(dateStr: string) {
  const { start, end } = siteDayUtcRange(dateStr);
  const { data: toClear } = await supabaseAdmin
    .from('fixtures')
    .select('id')
    .gte('match_date', start)
    .lte('match_date', end)
    .eq('status', 'NS');

  if (!toClear?.length) return 0;

  const ids = toClear.map((f) => f.id);
  await supabaseAdmin.from('odds').delete().in('fixture_id', ids);
  await supabaseAdmin.from('fixtures').delete().in('id', ids);
  return ids.length;
}

function fixtureKickoffSiteDate(item: any): string {
  return toSiteDateStr(item?.fixture?.date || '');
}

function buildSiteDayFixtureMap(allFixtures: any[], dateStr: string) {
  const map = new Map<number, any>();
  for (const item of allFixtures) {
    const fid = item?.fixture?.id;
    if (!fid) continue;
    if (fixtureKickoffSiteDate(item) === dateStr) {
      map.set(fid, item);
    }
  }
  return map;
}

/** Import up to 50 fixtures with odds for one calendar day (UTC+3 site day). */
export async function importFixturesForDate(dateStr: string, target = MATCHES_PER_DAY) {
  const cleared = await clearScheduledFixturesForDate(dateStr);

  const allFixtures = await apiFetch('/fixtures', { date: dateStr });
  const fixtureMap = buildSiteDayFixtureMap(allFixtures, dateStr);

  const importedIds = new Set<number>();
  const oddsDataMap = new Map<number, any>();
  const MAX_PAGES = 10;

  let page = 1;
  while (page <= MAX_PAGES && importedIds.size < target) {
    const oddsPage: any[] = await apiFetch('/odds', { date: dateStr, bookmaker: 8, page });
    if (!oddsPage?.length) break;

    for (const item of oddsPage) {
      const fid: number = item?.fixture?.id;
      if (!fid || !fixtureMap.has(fid) || importedIds.has(fid)) {
        continue;
      }
      importedIds.add(fid);
      oddsDataMap.set(fid, item);
      if (importedIds.size >= target) break;
    }

    if (oddsPage.length < 10) break;
    page++;
  }

  // If API date grouping missed site-day matches, try adjacent calendar dates.
  if (importedIds.size < target) {
    const tryDates = [
      addUtcDate(dateStr, -1),
      addUtcDate(dateStr, 1),
    ];
    for (const altDate of tryDates) {
      if (importedIds.size >= target) break;
      const altFixtures = await apiFetch('/fixtures', { date: altDate });
      const altMap = buildSiteDayFixtureMap(altFixtures, dateStr);
      for (const [fid, item] of altMap) {
        if (!fixtureMap.has(fid)) fixtureMap.set(fid, item);
      }

      let altPage = 1;
      while (altPage <= MAX_PAGES && importedIds.size < target) {
        const oddsPage: any[] = await apiFetch('/odds', { date: altDate, bookmaker: 8, page: altPage });
        if (!oddsPage?.length) break;
        for (const item of oddsPage) {
          const fid: number = item?.fixture?.id;
          if (!fid || !fixtureMap.has(fid) || importedIds.has(fid)) {
            continue;
          }
          importedIds.add(fid);
          oddsDataMap.set(fid, item);
          if (importedIds.size >= target) break;
        }
        if (oddsPage.length < 10) break;
        altPage++;
      }
    }
  }

  if (importedIds.size === 0) {
    return { date: dateStr, cleared, imported: 0, oddsSaved: 0 };
  }

  const validIds = new Set<number>();
  const compactOddsRecords: ReturnType<typeof buildCompactOddsRecord>[] = [];

  for (const fid of importedIds) {
    const compact = buildCompactOddsRecord(fid, oddsDataMap.get(fid));
    if (oddsRowHasMatchWinner(compact)) {
      validIds.add(fid);
      compactOddsRecords.push(compact);
    }
  }

  if (validIds.size === 0) {
    return { date: dateStr, cleared, imported: 0, oddsSaved: 0 };
  }

  const fixtureRecords: any[] = [];
  for (const fid of validIds) {
    const rec = buildFixtureRecord(fixtureMap.get(fid));
    if (rec) fixtureRecords.push(rec);
  }

  if (fixtureRecords.length > 0) {
    let fixturesSaved = 0;
    for (let i = 0; i < fixtureRecords.length; i += 25) {
      const chunk = fixtureRecords.slice(i, i + 25);
      const { error } = await supabaseAdmin.from('fixtures').upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.error(`[import] fixtures upsert failed for ${dateStr}:`, error.message);
        throw new Error(`Failed to save fixtures: ${error.message}`);
      }
      fixturesSaved += chunk.length;
    }
    console.log(`[import] ${dateStr}: saved ${fixturesSaved} fixtures`);
  }

  const compactOddsRecordsToSave = compactOddsRecords;

  let oddsSaved = 0;
  for (let i = 0; i < compactOddsRecordsToSave.length; i += 10) {
    const chunk = compactOddsRecordsToSave.slice(i, i + 10);
    const { error } = await supabaseAdmin.from('odds').upsert(chunk, { onConflict: 'id' });
    if (!error) oddsSaved += chunk.length;
  }

  return { date: dateStr, cleared, imported: validIds.size, oddsSaved, siteDayCandidates: fixtureMap.size };
}

function addUtcDate(dateStr: string, deltaDays: number): string {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch fixtures for the next 7 days (today + 6 days ahead).
 * Up to 50 matches per day with odds (350 max total after cleanup).
 * Budget: ~7 fixture calls + ~70 odds pages = ~80 requests per run.
 */
export async function fetchAndStoreFixturesForWindow() {
  const dayResults: Awaited<ReturnType<typeof importFixturesForDate>>[] = [];
  let totalFixtures = 0;
  let totalOdds = 0;

  for (const bucket of siteDayBuckets()) {
    const dateStr = bucket.date;

    try {
      const result = await importFixturesForDate(dateStr, MATCHES_PER_DAY);
      dayResults.push(result);
      totalFixtures += result.imported;
      totalOdds += result.oddsSaved;
      console.log(
        `[bootstrap] ${dateStr}: cleared=${result.cleared} imported=${result.imported} odds=${result.oddsSaved} candidates=${result.siteDayCandidates ?? 0}`
      );
    } catch (dayErr: any) {
      if (dayErr.message?.includes('daily limit')) {
        console.error('[bootstrap] Daily API quota hit — stopping early.');
        break;
      }
      console.error(`[bootstrap] Error on date ${dateStr}:`, dayErr.message);
      dayResults.push({ date: dateStr, cleared: 0, imported: 0, oddsSaved: 0, siteDayCandidates: 0 });
    }
  }

  const cleanup = await cleanupMatchDatabase();

  return {
    fixturesSeen: totalFixtures,
    oddsSaved: totalOdds,
    daysProcessed: dayResults.length,
    dayResults,
    cleanup,
  };
}

// ──────────────────────────────────────────────
// LIVE SYNC: scores + live odds update
// Budget: 2 requests per run (every minute = 2,880/day)
// ──────────────────────────────────────────────

export async function syncLiveMatches() {
  let fixturesUpdated = 0;
  let oddsUpdated = 0;

  // 1 request: get all currently live matches with scores
  const liveFixtures = await apiFetch('/fixtures', { live: 'all' });

  if (liveFixtures.length === 0) {
    return { fixturesUpdated: 0, oddsUpdated: 0, liveCount: 0 };
  }

  const fixtureRecords: any[] = [];
  const liveIds: number[] = [];

  for (const item of liveFixtures) {
    const record = buildFixtureRecord(item);
    if (record) {
      fixtureRecords.push(record);
      liveIds.push(record.id);
    }
  }

  if (fixtureRecords.length > 0) {
    for (let i = 0; i < fixtureRecords.length; i += 200) {
      await supabaseAdmin.from('fixtures').upsert(fixtureRecords.slice(i, i + 200), { onConflict: 'id' });
    }
    fixturesUpdated = fixtureRecords.length;
  }

  // 1 request: get live in-play odds for ALL live matches
  try {
    const liveOdds = await apiFetch('/odds/live', { bet: 1 }); // bet=1 = Match Winner
    for (const oddsItem of liveOdds) {
      const fid: number = oddsItem?.fixture?.id;
      if (!fid) continue;
      const stored = await storeOddsFromData(fid, [oddsItem]);
      oddsUpdated += stored;
    }
  } catch (oddsErr: any) {
    if (oddsErr.message?.includes('daily limit')) throw oddsErr;
    console.error('[live-sync] Live odds fetch error:', oddsErr.message);
  }

  return { fixturesUpdated, oddsUpdated, liveCount: liveFixtures.length };
}

// ──────────────────────────────────────────────
// SETTLE: Auto-win/loss from DB fixture statuses
// Budget: 0 API requests (only reads Supabase)
// ──────────────────────────────────────────────

export async function settleFinishedBets() {
  let settled = 0;

  // Get all fixtures that are FT (full time) or ended
  const FINISHED_STATUSES = ['FT', 'AET', 'PEN', 'AWD', 'WO'];

  const { data: finishedFixtures } = await supabaseAdmin
    .from('fixtures')
    .select('id, home_goals, away_goals, status')
    .in('status', FINISHED_STATUSES);

  const finishedMap = new Map<string, { home: number | null; away: number | null; status: string }>();
  for (const f of (finishedFixtures || [])) {
    finishedMap.set(String(f.id), {
      home: f.home_goals,
      away: f.away_goals,
      status: f.status,
    });
  }

  const { data: pendingSlips } = await supabaseAdmin
    .from('bet_slips')
    .select('*')
    .eq('status', 'pending');

  for (const slip of (pendingSlips || [])) {
    const selections: any[] = slip.selections || [];
    let allResolved = true;
    let anyLost = false;
    const updatedSelections = selections.map((s: any) => ({ ...s }));

    for (const s of updatedSelections) {
      if (s.result === 'won' || s.result === 'lost') continue;

      if (s.is_manual || s.manual_end_at) {
        // Manual match: auto-win after end time
        const ended = s.manual_end_at && new Date(s.manual_end_at).getTime() <= Date.now();
        if (ended) {
          s.result = 'won';
        } else {
          allResolved = false;
        }
      } else {
        const fixtureResult = finishedMap.get(String(s.fixture_id));
        if (!fixtureResult) {
          // Still in progress
          allResolved = false;
          continue;
        }

        // Resolve based on selection
        const resolved = resolveSelection(s, fixtureResult);
        if (resolved === null) {
          allResolved = false;
        } else {
          s.result = resolved ? 'won' : 'lost';
          if (!resolved) anyLost = true;
        }
      }
    }

    if (!allResolved) {
      // Partially update manual wins in-progress
      const hasPartialManualWins = updatedSelections.some((s: any) => s.result === 'won' && s.is_manual);
      if (hasPartialManualWins) {
        await supabaseAdmin.from('bet_slips').update({
          selections: updatedSelections,
          updated_at: new Date().toISOString(),
        }).eq('id', slip.id);
      }
      continue;
    }

    const newStatus = anyLost ? 'lost' : 'won';

    try {
      await supabaseAdmin.from('bet_slips').update({
        status: newStatus,
        selections: updatedSelections,
        updated_at: new Date().toISOString(),
      }).eq('id', slip.id);

      if (newStatus === 'won' && slip.user_id && !slip.paid_out) {
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('balance')
          .eq('id', slip.user_id)
          .single();

        if (userData) {
          const currentBalance = Number(userData.balance) || 0;
          const payout = Number(slip.potential_win || slip.possible_win || 0);
          await supabaseAdmin.from('users').update({
            balance: currentBalance + payout,
            updated_at: new Date().toISOString(),
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

/**
 * Resolve a bet selection against a finished fixture result.
 * Returns true = won, false = lost, null = cannot determine.
 */
function resolveSelection(selection: any, result: { home: number | null; away: number | null }): boolean | null {
  const { home, away } = result;
  if (home === null || away === null) return null;

  const market = (selection.market_key || selection.market || '').toLowerCase();
  const sel = (selection.selection || selection.pick || '').toLowerCase().trim();

  // Match Winner / 1X2
  if (market.includes('match_winner') || market.includes('1x2') || market === '') {
    if (sel === 'home' || sel === '1') return home > away;
    if (sel === 'draw' || sel === 'x') return home === away;
    if (sel === 'away' || sel === '2') return away > home;
  }

  // Over/Under
  if (market.includes('over_under') || market.includes('goals')) {
    const total = home + away;
    const match = sel.match(/(over|under)\s*([\d.]+)/);
    if (match) {
      const line = parseFloat(match[2]);
      if (match[1] === 'over') return total > line;
      if (match[1] === 'under') return total < line;
    }
  }

  // Both Teams to Score
  if (market.includes('both_teams') || market.includes('btts')) {
    const bothScored = home > 0 && away > 0;
    if (sel === 'yes') return bothScored;
    if (sel === 'no') return !bothScored;
  }

  // Double Chance
  if (market.includes('double_chance')) {
    if (sel === '1x') return home >= away;
    if (sel === '12') return home !== away;
    if (sel === 'x2') return away >= home;
  }

  return null; // Unknown market — cannot auto-settle
}

// ──────────────────────────────────────────────
// PURGE: Delete old finished matches (runs daily)
// ──────────────────────────────────────────────

export async function cleanupMatchDatabase(maxTotal = MAX_TOTAL_MATCHES) {
  const log: string[] = [];
  const push = (msg: string) => {
    log.push(msg);
    console.log(`[match-cleanup] ${msg}`);
  };

  const finishedStatuses = ['FT', 'AET', 'PEN', 'ABD', 'AWD', 'WO'];
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: oldMatches } = await supabaseAdmin
    .from('fixtures')
    .select('id')
    .in('status', finishedStatuses)
    .lt('kickoff_at', twentyFourHoursAgo);

  let deletedFixtures = 0;
  let deletedOdds = 0;

  if (oldMatches?.length) {
    const ids = oldMatches.map((m) => m.id);
    const { data: deletedOddsData } = await supabaseAdmin
      .from('odds')
      .delete()
      .in('fixture_id', ids)
      .select('id');
    deletedOdds = deletedOddsData?.length || 0;
    await supabaseAdmin.from('fixtures').delete().in('id', ids);
    deletedFixtures = ids.length;
    push(`Deleted ${deletedFixtures} finished matches older than 24h`);
  }

  const fixtureIdsWithOdds = await loadFixtureIdsWithDisplayOdds();

  const { data: allFixtures } = await supabaseAdmin.from('fixtures').select('id, kickoff_at, status');
  const { start: windowStart, end: windowEnd } = siteWindowRange();

  const withoutOdds: number[] = [];
  const outsideWindow: number[] = [];

  for (const f of allFixtures || []) {
    const fid = Number(f.id);
    if (!fixtureIdsWithOdds.has(fid)) {
      withoutOdds.push(fid);
      continue;
    }
    const kickoff = f.kickoff_at || '';
    const status = String(f.status || 'NS').toUpperCase();
    if (kickoff && (kickoff < windowStart || kickoff > windowEnd) && ['NS', 'TBD', 'PST'].includes(status)) {
      outsideWindow.push(f.id);
    }
  }

  const idsToDelete = [...new Set([...withoutOdds, ...outsideWindow])];
  if (idsToDelete.length > 0) {
    await supabaseAdmin.from('odds').delete().in('fixture_id', idsToDelete);
    await supabaseAdmin.from('fixtures').delete().in('id', idsToDelete);
    push(
      `Deleted ${withoutOdds.length} fixtures without valid odds and ${outsideWindow.length} outside the 7-day window`
    );
  }

  const { data: allMatchIds } = await supabaseAdmin
    .from('fixtures')
    .select('id')
    .order('kickoff_at', { ascending: false });

  let pruned = 0;
  if (allMatchIds && allMatchIds.length > maxTotal) {
    const idsToPrune = allMatchIds.slice(maxTotal).map((m) => m.id);
    const { data: prunedOdds } = await supabaseAdmin
      .from('odds')
      .delete()
      .in('fixture_id', idsToPrune)
      .select('id');
    deletedOdds += prunedOdds?.length || 0;
    await supabaseAdmin.from('fixtures').delete().in('id', idsToPrune);
    pruned = idsToPrune.length;
    deletedFixtures += pruned;
    push(`Pruned ${pruned} oldest matches to stay under ${maxTotal}`);
  } else {
    push(`Database size OK (${allMatchIds?.length || 0} / ${maxTotal})`);
  }

  return { deletedFixtures, deletedOdds, pruned, log };
}

export async function purgeOldFinishedFixtures() {
  return cleanupMatchDatabase();
}

// ──────────────────────────────────────────────
// QUOTA STATUS
// ──────────────────────────────────────────────

export async function getApiQuotaStatus() {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'api_quota')
    .single();
  return data?.value || { requests_today: 0, limit: 7500 };
}

export async function fetchAndStoreOddsForFixture(fixtureId: number) {
  const data = await apiFetch('/odds', { fixture: fixtureId });
  if (!data.length) return 0;
  return storeOddsFromData(fixtureId, data);
}
