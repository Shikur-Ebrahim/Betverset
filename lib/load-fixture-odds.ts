import { supabaseAdmin } from '@/lib/supabase-admin';

const MW_KEYS = ['match_winner', 'home_away', '1x2', 'full_time_result'];
const MW_NAME_PARTS = ['match winner', 'home/away', 'full time result', 'fulltime result', '1x2', '3way', 'winner'];

function parseMarkets(markets: unknown): { flat_markets?: any[]; bookmakers?: any[] } {
  if (!markets) return {};
  if (typeof markets === 'string') {
    try {
      return JSON.parse(markets);
    } catch {
      return {};
    }
  }
  if (typeof markets === 'object') return markets as { flat_markets?: any[]; bookmakers?: any[] };
  return {};
}

function pricedValues(values: any[] | undefined): any[] {
  return (values || []).filter((v) => v?.odd && Number(v.odd) > 0);
}

function marketLooksLikeMatchWinner(market: any): boolean {
  const mk = String(market?.market_key || '').toLowerCase();
  const mn = String(market?.market_name || '').toLowerCase();
  if (MW_KEYS.includes(mk)) return true;
  return MW_NAME_PARTS.some((part) => mn.includes(part) || mk.includes(part.replace(/\s+/g, '_')));
}

function compactRowHasDisplayOdds(row: {
  market_key?: string;
  markets?: unknown;
}): boolean {
  if (row.market_key !== 'all_markets') return false;
  const parsed = parseMarkets(row.markets);
  const flatMarkets: any[] = parsed.flat_markets || [];

  if (flatMarkets.length > 0) {
    for (const market of flatMarkets) {
      const priced = pricedValues(market.values);
      if (marketLooksLikeMatchWinner(market) && priced.length >= 2) return true;
    }
    return flatMarkets.some((market) => pricedValues(market.values).length >= 2);
  }

  const bookmakers: any[] = parsed.bookmakers || [];
  for (const bookmaker of bookmakers) {
    for (const bet of bookmaker?.bets || []) {
      const priced = pricedValues(
        (bet?.values || []).map((v: any) => ({
          odd: parseFloat(v.odd),
          selection: v.value,
        }))
      );
      if (marketLooksLikeMatchWinner({ market_key: bet.name, market_name: bet.name }) && priced.length >= 2) {
        return true;
      }
      if (priced.length >= 2) return true;
    }
  }

  return false;
}

function legacyRowSelectionCount(row: {
  market_key?: string;
  market_name?: string;
  selection?: string;
  odd_value?: number | null;
}): number {
  const mk = (row.market_key || '').toLowerCase();
  const mn = (row.market_name || '').toLowerCase();
  const isMW =
    MW_KEYS.some((k) => mk.includes(k)) || MW_NAME_PARTS.some((n) => mn.includes(n));
  if (!isMW || !row.odd_value || row.odd_value <= 0 || !row.selection) return 0;
  return 1;
}

/** True when a stored odds row can be shown on the home list (1X2 or similar). */
export function oddsRowHasMatchWinner(row: {
  fixture_id?: number | string;
  market_key?: string;
  market_name?: string;
  selection?: string;
  odd_value?: number | null;
  markets?: unknown;
}): boolean {
  if (row.market_key === 'all_markets') return compactRowHasDisplayOdds(row);
  return legacyRowSelectionCount(row) >= 1;
}

function fixtureIdFromRow(row: { fixture_id?: number | string }): number | null {
  const id = Number(row.fixture_id);
  return Number.isFinite(id) ? id : null;
}

async function fetchOddsRowsForFixtures(fixtureIds: number[]) {
  const oddsRows: any[] = [];
  for (let i = 0; i < fixtureIds.length; i += 80) {
    const chunk = fixtureIds.slice(i, i + 80);
    const { data, error } = await supabaseAdmin
      .from('odds')
      .select('fixture_id, market_name, market_key, selection, odd_value, markets')
      .in('fixture_id', chunk);
    if (error) throw error;
    if (data?.length) oddsRows.push(...data);
  }
  return oddsRows;
}

function fixtureIdsWithDisplayOdds(oddsRows: any[]): Set<number> {
  const legacyCounts = new Map<number, number>();
  const valid = new Set<number>();

  for (const row of oddsRows) {
    const fid = fixtureIdFromRow(row);
    if (fid == null) continue;

    if (row.market_key === 'all_markets') {
      if (compactRowHasDisplayOdds(row)) valid.add(fid);
      continue;
    }

    const count = legacyRowSelectionCount(row);
    if (count === 1) legacyCounts.set(fid, (legacyCounts.get(fid) || 0) + 1);
  }

  for (const [fid, count] of legacyCounts.entries()) {
    if (count >= 2) valid.add(fid);
  }

  return valid;
}

function addMatchWinnerFromCompactRow(
  odds: Record<string, any[]>,
  row: { fixture_id: number; markets?: unknown }
) {
  const fid = String(row.fixture_id);
  if (!odds[fid]) odds[fid] = [];

  const parsed = parseMarkets(row.markets);
  const flatMarkets: any[] = parsed.flat_markets || [];

  let mwMarket = flatMarkets.find((m) => marketLooksLikeMatchWinner(m));
  if (!mwMarket) mwMarket = flatMarkets.find((m) => pricedValues(m.values).length >= 2);
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
  const isMW =
    MW_KEYS.some((k) => mk.includes(k)) || MW_NAME_PARTS.some((n) => mn.includes(n));
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
    if (row.market_key === 'all_markets') {
      const parsed = parseMarkets(row.markets);
      for (const market of parsed.flat_markets || []) {
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

  const fixtureIds = fixtures.map((f: any) => Number(f.id)).filter((id) => Number.isFinite(id));
  const oddsRows = await fetchOddsRowsForFixtures(fixtureIds);

  for (const row of oddsRows) {
    if (row.market_key === 'all_markets') {
      addMatchWinnerFromCompactRow(odds, row);
    } else {
      addMatchWinnerFromLegacyRow(odds, row);
    }
  }

  return odds;
}

/** Keep fixtures that have displayable odds in the database. */
export async function filterFixturesWithOdds(fixtures: any[]) {
  if (fixtures.length === 0) return fixtures;

  const fixtureIds = fixtures.map((f: any) => Number(f.id)).filter((id) => Number.isFinite(id));
  const oddsRows = await fetchOddsRowsForFixtures(fixtureIds);
  const idsWithOdds = fixtureIdsWithDisplayOdds(oddsRows);

  return fixtures.filter((f) => idsWithOdds.has(Number(f.id)));
}

/** Fixture IDs that have at least one qualifying odds row (for cleanup). */
export async function loadFixtureIdsWithDisplayOdds(): Promise<Set<number>> {
  const { data: oddsRows, error } = await supabaseAdmin
    .from('odds')
    .select('fixture_id, market_name, market_key, selection, odd_value, markets');
  if (error) throw error;
  return fixtureIdsWithDisplayOdds(oddsRows || []);
}
