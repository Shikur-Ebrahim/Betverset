/**
 * import-day.js
 * 
 * Fetches up to 50 fixtures+odds for a given date from API-Football,
 * then POSTs the data to the local Next.js /api/admin/matches/save endpoint
 * (which uses the working supabaseAdmin connection).
 * 
 * Usage: node import-day.js 2026-07-07
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.FOOTBALL_API_KEY || '028d83b02360897f54f9e8921f48a01b';
const API_HOST = process.env.API_FOOTBALL_HOST || 'v3.football.api-sports.io';
const API_BASE = `https://${API_HOST}`;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hfkbbojtkdqcgtxlleoe.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is missing in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function apiFetch(endpoint, params = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), { headers: { 'x-apisports-key': API_KEY } });
  if (!res.ok) throw new Error(`API HTTP ${res.status} for ${endpoint}`);
  const json = await res.json();
  return json.response || [];
}

function buildFixtureRecord(item) {
  const f = item?.fixture;
  const teams = item?.teams;
  const league = item?.league;
  const goals = item?.goals;
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
    data: item,
    updated_at: new Date().toISOString(),
  };
}

function buildCompactOddsRecord(fixtureId, oddsItem) {
  const bookmakers = oddsItem?.bookmakers || [];
  const markets = [];
  for (const bookmaker of bookmakers) {
    if (!bookmaker?.id) continue;
    for (const bet of bookmaker?.bets || []) {
      const marketKey = (bet.name || '').toLowerCase().replace(/\s+/g, '_');
      const values = (bet?.values || [])
        .map(v => ({ selection: String(v.value || ''), odd: parseFloat(v.odd) || null }))
        .filter(v => v.odd && v.odd > 0);
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

async function saveWithRetry(table, records, label) {
  // Save in chunks of 20, with 3s sleep between chunks
  let saved = 0;
  for (let i = 0; i < records.length; i += 20) {
    const chunk = records.slice(i, i + 20);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.log(`  [WARN] ${label} chunk ${i} error: ${error.message} — retrying in 5s...`);
      await sleep(5000);
      const { error: err2 } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
      if (!err2) { saved += chunk.length; }
      else console.log(`  [FAIL] ${label} chunk ${i} retry failed: ${err2.message}`);
    } else {
      saved += chunk.length;
    }
    if (records.length > 20) await sleep(500); // small pause between chunks
  }
  return saved;
}

async function run(dateStr) {
  console.log(`\n=== Starting import for ${dateStr} ===\n`);

  // 1. Fetch all fixtures
  console.log('1. Fetching fixtures from API-Football...');
  const allFixtures = await apiFetch('/fixtures', { date: dateStr });
  const fixtureMap = new Map();
  for (const f of allFixtures) {
    if (f?.fixture?.id) fixtureMap.set(f.fixture.id, f);
  }
  console.log(`   Found ${fixtureMap.size} total fixtures for ${dateStr}`);

  // 2. Page through odds, collect up to 50 fixtures that have odds
  const importedIds = new Set();
  const oddsDataMap = new Map();

  let page = 1;
  while (page <= 10 && importedIds.size < 50) {
    console.log(`2. Fetching odds page ${page}...`);
    const oddsPage = await apiFetch('/odds', { date: dateStr, bookmaker: 8, page });
    if (!oddsPage || oddsPage.length === 0) { console.log('   No more odds data.'); break; }

    for (const item of oddsPage) {
      const fid = item?.fixture?.id;
      if (fid && fixtureMap.has(fid)) {
        importedIds.add(fid);
        oddsDataMap.set(fid, item);
        if (importedIds.size >= 50) break;
      }
    }
    console.log(`   → ${importedIds.size} fixtures with odds so far.`);
    if (oddsPage.length < 10) break;
    page++;
    await sleep(1000);
  }

  console.log(`\n   Total fixtures with odds: ${importedIds.size}`);
  if (importedIds.size === 0) {
    console.log('   No fixtures with odds found. Exiting.');
    return;
  }

  // 3. Build records
  const fixtureRecords = [];
  const oddsRecords = [];
  for (const fid of importedIds) {
    const fr = buildFixtureRecord(fixtureMap.get(fid));
    if (fr) fixtureRecords.push(fr);
    oddsRecords.push(buildCompactOddsRecord(fid, oddsDataMap.get(fid)));
  }

  // 4. Save fixtures
  console.log(`\n3. Saving ${fixtureRecords.length} fixtures...`);
  const fixturesSaved = await saveWithRetry('fixtures', fixtureRecords, 'fixtures');
  console.log(`   Saved ${fixturesSaved}/${fixtureRecords.length} fixtures. ✓`);

  await sleep(2000);

  // 5. Save odds
  console.log(`\n4. Saving ${oddsRecords.length} compact odds records...`);
  const oddsSaved = await saveWithRetry('odds', oddsRecords, 'odds');
  console.log(`   Saved ${oddsSaved}/${oddsRecords.length} odds records. ✓`);

  console.log(`\n✅ Done! ${importedIds.size} matches imported for ${dateStr}`);
  console.log(`   Fixtures: ${fixturesSaved}, Odds: ${oddsSaved}\n`);
}

const dateStr = process.argv[2];
if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
  console.error('Usage: node import-day.js YYYY-MM-DD');
  process.exit(1);
}

run(dateStr).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
