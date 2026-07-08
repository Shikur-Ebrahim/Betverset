import { supabaseAdmin } from '@/lib/supabase-admin';

const MW_KEYS = ['match_winner', 'home_away', '1x2'];
const MW_NAMES = ['match winner', 'home/away', 'full time result', '1x2'];

function countPricedMatchWinnerSelections(row: {
  market_key?: string;
  market_name?: string;
  selection?: string;
  odd_value?: number | null;
  markets?: { flat_markets?: any[] };
}): number {
  if (row.market_key === 'all_markets' && row.markets?.flat_markets) {
    const flatMarkets: any[] = row.markets.flat_markets;
    const mwMarket = flatMarkets.find(
      (m: any) =>
        MW_KEYS.includes(m.market_key) ||
        MW_NAMES.includes((m.market_name || '').toLowerCase())
    );
    if (!mwMarket) return 0;
    return (mwMarket.values || []).filter((v: any) => v.odd && v.odd > 0).length;
  }

  const mk = (row.market_key || '').toLowerCase();
  const mn = (row.market_name || '').toLowerCase();
  const isMW = MW_KEYS.some((k) => mk.includes(k)) || MW_NAMES.some((n) => mn.includes(n));
  if (!isMW || !row.odd_value || row.odd_value <= 0 || !row.selection) return 0;
  return 1;
}

/** True when a stored odds row has at least two priced match-winner selections. */
export function oddsRowHasMatchWinner(row: {
  fixture_id?: number;
  market_key?: string;
  market_name?: string;
  selection?: string;
  odd_value?: number | null;
  markets?: { flat_markets?: any[] };
}): boolean {
  return countPricedMatchWinnerSelections(row) >= 2;
}

function addMatchWinnerFromCompactRow(
  odds: Record<string, any[]>,
  row: { fixture_id: number; markets?: { flat_markets?: any[] } }
) {
  const fid = String(row.fixture_id);
  if (!odds[fid]) odds[fid] = [];

  const flatMarkets: any[] = row.markets?.flat_markets || [];
  const mwMarket = flatMarkets.find(
    (m: any) =>
      MW_KEYS.includes(m.market_key) ||
      MW_NAMES.includes((m.market_name || '').toLowerCase())
  );

  if (!mwMarket) return;

  for (const val of mwMarket.values || []) {
    if (!val.odd || val.odd <= 0) continue;
    const selLower = (val.selection || '').toLowerCase();
    const exists = odds[fid].some((x: any) => (x.selection || '').toLowerCase() === selLower);
    if (!exists) {
      odds[fid].push({
        fixture_id: row.fixture_id,
        market_name: mwMarket.market_name,
        market_key: mwMarket.market_key,
        selection: val.selection,
        odd_value: val.odd,
      });
    }
  }
}

function addMatchWinnerFromLegacyRow(odds: Record<string, any[]>, row: any) {
  const mk = (row.market_key || '').toLowerCase();
  const mn = (row.market_name || '').toLowerCase();
  const isMW = MW_KEYS.some((k) => mk.includes(k)) || MW_NAMES.some((n) => mn.includes(n));
  if (!isMW || !row.odd_value || row.odd_value <= 0 || !row.selection) return;

  const fid = String(row.fixture_id);
  if (!odds[fid]) odds[fid] = [];
  const selLower = (row.selection || '').toLowerCase();
  const exists = odds[fid].some((x: any) => (x.selection || '').toLowerCase() === selLower);
  if (!exists) {
    odds[fid].push({
      fixture_id: row.fixture_id,
      market_name: row.market_name,
      market_key: row.market_key,
      selection: row.selection,
      odd_value: row.odd_value,
    });
  }
}

/** Expand DB odds rows (compact + legacy) into flat Odd[] for the UI. */
export function expandOddsRows(fixtureId: number, oddsRows: any[]) {
  const allOdds: any[] = [];

  for (const row of oddsRows) {
    if (row.market_key === 'all_markets' && row.markets?.flat_markets) {
      for (const market of row.markets.flat_markets) {
        for (const val of market.values || []) {
          if (!val.odd || val.odd <= 0) continue;
          allOdds.push({
            fixture_id: fixtureId,
            market_id: market.market_id,
            market_name: market.market_name,
            market_key: market.market_key,
            bookmaker_id: market.bookmaker_id,
            bookmaker_name: market.bookmaker_name,
            selection: val.selection,
            odd_value: val.odd,
          });
        }
      }
    } else if (row.odd_value !== null && row.selection && row.selection !== 'all') {
      allOdds.push({
        fixture_id: row.fixture_id,
        market_id: row.market_id,
        market_name: row.market_name,
        market_key: row.market_key,
        bookmaker_id: row.bookmaker_id,
        bookmaker_name: row.bookmaker_name,
        selection: row.selection,
        odd_value: row.odd_value,
      });
    }
  }

  return allOdds;
}

export async function loadMatchWinnerOddsForFixtures(fixtures: any[]) {
  const odds: Record<string, any[]> = {};

  for (const f of fixtures) {
    if (f.home_odds || f.draw_odds || f.away_odds) {
      const fid = String(f.id);
      const items = [
        { fixture_id: f.id, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Home', odd_value: f.home_odds || null },
        { fixture_id: f.id, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Draw', odd_value: f.draw_odds || null },
        { fixture_id: f.id, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Away', odd_value: f.away_odds || null },
      ].filter((o) => o.odd_value !== null);
      if (items.length) odds[fid] = items;
    }
  }

  if (fixtures.length === 0) return odds;

  const fixtureIds = fixtures.map((f: any) => f.id);
  const { data: oddsRows } = await supabaseAdmin
    .from('odds')
    .select('fixture_id, market_name, market_key, selection, odd_value, markets')
    .in('fixture_id', fixtureIds.slice(0, 500));

  for (const row of oddsRows || []) {
    if (row.market_key === 'all_markets' && row.markets?.flat_markets) {
      addMatchWinnerFromCompactRow(odds, row);
    } else {
      addMatchWinnerFromLegacyRow(odds, row);
    }
  }

  return odds;
}

/** Keep only fixtures that have usable match-winner odds saved in the database. */
export async function filterFixturesWithOdds(fixtures: any[]) {
  if (fixtures.length === 0) return fixtures;

  const fixtureIds = fixtures.map((f: any) => f.id);
  const { data: oddsRows } = await supabaseAdmin
    .from('odds')
    .select('fixture_id, market_name, market_key, selection, odd_value, markets')
    .in('fixture_id', fixtureIds);

  const pricedCounts = new Map<number, number>();
  for (const row of oddsRows || []) {
    const fid = row.fixture_id as number;
    const count = countPricedMatchWinnerSelections(row);
    if (count >= 2) {
      pricedCounts.set(fid, Math.max(pricedCounts.get(fid) || 0, count));
    } else if (count === 1) {
      pricedCounts.set(fid, (pricedCounts.get(fid) || 0) + 1);
    }
  }

  const idsWithOdds = new Set<number>();
  for (const [fid, count] of pricedCounts.entries()) {
    if (count >= 2) idsWithOdds.add(fid);
  }

  return fixtures.filter((f) => idsWithOdds.has(f.id));
}
