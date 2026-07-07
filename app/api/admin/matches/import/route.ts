import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const API_HOST = process.env.API_FOOTBALL_HOST || 'v3.football.api-sports.io';
const API_BASE = `https://${API_HOST}`;
const API_KEY = process.env.FOOTBALL_API_KEY || '';

async function apiFetch(endpoint: string, params: Record<string, string | number> = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), {
    headers: { 'x-apisports-key': API_KEY },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
  const json = await res.json();
  return json?.response ?? [];
}

function buildFixtureRecord(item: any) {
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

function buildCompactOddsRecord(fixtureId: number, oddsItem: any): any {
  // Store all bookmakers/markets/values as one JSONB blob per fixture
  // This is compact (1 row per fixture) and avoids thousands of tiny rows
  const bookmakers: any[] = oddsItem?.bookmakers ?? [];

  // Also extract flat market list for easy querying
  const markets: any[] = [];
  for (const bookmaker of bookmakers) {
    if (!bookmaker?.id) continue;
    for (const bet of bookmaker?.bets ?? []) {
      const marketKey = (bet.name || '').toLowerCase().replace(/\s+/g, '_');
      const values = (bet?.values ?? []).map((v: any) => ({
        selection: String(v.value || ''),
        odd: parseFloat(v.odd) || null,
      })).filter((v: any) => v.odd && v.odd > 0);

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

  // One unique row per fixture (using fixture_id as the unique key via the id field)
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
    markets: { bookmakers, flat_markets: markets }, // full raw + flat list
    updated_at: new Date().toISOString(),
  };
}


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date');

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'Invalid or missing date parameter (YYYY-MM-DD)' }, { status: 400 });
  }

  const log: string[] = [];
  const push = (msg: string) => { log.push(msg); console.log(`[MatchImport] ${msg}`); };

  try {
    push(`Starting import for ${dateStr}...`);

    // 1. Fetch all fixtures for the day
    push('Fetching fixtures from API-Football...');
    const allFixtures = await apiFetch('/fixtures', { date: dateStr });
    const fixtureMap = new Map<number, any>();
    for (const item of allFixtures) {
      if (item?.fixture?.id) fixtureMap.set(item.fixture.id, item);
    }
    push(`Total fixtures from API: ${fixtureMap.size}`);

    // 2. Page through odds to find fixtures that have odds (max 50)
    const importedIds = new Set<number>();
    const oddsDataMap = new Map<number, any>(); // fixtureId -> odds item

    let page = 1;
    const MAX_PAGES = 10;
    const TARGET = 50;

    while (page <= MAX_PAGES && importedIds.size < TARGET) {
      push(`Fetching odds page ${page}...`);
      const oddsPage: any[] = await apiFetch('/odds', { date: dateStr, bookmaker: 8, page });
      if (!oddsPage || oddsPage.length === 0) {
        push(`No more odds data on page ${page}. Done.`);
        break;
      }

      for (const item of oddsPage) {
        const fid: number = item?.fixture?.id;
        if (fid && fixtureMap.has(fid)) {
          importedIds.add(fid);
          oddsDataMap.set(fid, item);
          if (importedIds.size >= TARGET) break;
        }
      }

      push(`  → Found ${importedIds.size} fixtures with odds so far.`);
      if (oddsPage.length < 10) break; // last page
      page++;
    }

    push(`Fixtures with valid odds: ${importedIds.size}`);

    if (importedIds.size === 0) {
      return NextResponse.json({ ok: true, log, imported: 0, message: 'No fixtures with odds found for this date.' });
    }

    // 3. Save fixtures to DB in chunks with retry
    push('Saving fixtures to database...');
    const fixtureRecords = [];
    for (const fid of importedIds) {
      const rec = buildFixtureRecord(fixtureMap.get(fid));
      if (rec) fixtureRecords.push(rec);
    }

    if (fixtureRecords.length > 0) {
      let fixturesSaved = 0;
      for (let i = 0; i < fixtureRecords.length; i += 25) {
        const chunk = fixtureRecords.slice(i, i + 25);
        const { error: fErr } = await supabaseAdmin.from('fixtures').upsert(chunk, { onConflict: 'id' });
        if (fErr) {
          push(`WARNING: Fixtures chunk error: ${fErr.message} — retrying...`);
          await new Promise(r => setTimeout(r, 3000));
          const { error: retryErr } = await supabaseAdmin.from('fixtures').upsert(chunk, { onConflict: 'id' });
          if (!retryErr) fixturesSaved += chunk.length;
        } else {
          fixturesSaved += chunk.length;
        }
      }
      push(`Saved ${fixturesSaved}/${fixtureRecords.length} fixtures. ✓`);
    }

    // 4. Build compact odds records (1 per fixture) and save in one upsert
    push('Saving odds to database...');
    const compactOddsRecords = [];
    for (const fid of importedIds) {
      const oddsItem = oddsDataMap.get(fid);
      const rec = buildCompactOddsRecord(fid, oddsItem);
      compactOddsRecords.push(rec);
    }

    // Wait 2s to let Supabase connections settle before saving
    await new Promise(r => setTimeout(r, 2000));

    let oddsSavedCount = 0;
    // Save in chunks of 10 to avoid overwhelming the connection pool
    for (let i = 0; i < compactOddsRecords.length; i += 10) {
      const chunk = compactOddsRecords.slice(i, i + 10);
      const { error: oddsErr } = await supabaseAdmin
        .from('odds')
        .upsert(chunk, { onConflict: 'id' });
      if (oddsErr) {
        push(`WARNING: Odds chunk error: ${oddsErr.message}`);
        // Retry once after 3s
        await new Promise(r => setTimeout(r, 3000));
        const { error: retryErr } = await supabaseAdmin.from('odds').upsert(chunk, { onConflict: 'id' });
        if (!retryErr) oddsSavedCount += chunk.length;
      } else {
        oddsSavedCount += chunk.length;
      }
    }
    push(`Saved odds for ${oddsSavedCount}/${compactOddsRecords.length} fixtures. ✓`);

    push(`✅ Import complete! ${importedIds.size} matches imported with odds for ${dateStr}.`);

    return NextResponse.json({
      ok: true,
      log,
      imported: importedIds.size,
      oddsSaved: oddsSavedCount,
      date: dateStr,
    });
  } catch (err: any) {
    push(`❌ Error: ${err.message}`);
    return NextResponse.json({ ok: false, log, error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
