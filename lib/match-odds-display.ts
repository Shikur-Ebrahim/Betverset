import type { Odd } from './api';

function isMatchWinnerMarket(o: Odd): boolean {
  const m = (o.market_name || '').toLowerCase();
  const k = (o.market_key || '').toLowerCase();
  return (
    m.includes('match winner') ||
    m.includes('full time result') ||
    m.includes('home/away') ||
    m === '1x2' ||
    m.includes('3way') ||
    k === '1x2' ||
    k.includes('match_winner')
  );
}

const MATCH_WINNER_SORT: Record<string, number> = {
  home: 1,
  '1': 1,
  draw: 2,
  x: 2,
  away: 3,
  '2': 3,
};

function sortMatchWinnerSelections(odds: Odd[]): Odd[] {
  return [...odds].sort((a, b) => {
    const orderA = MATCH_WINNER_SORT[a.selection.toLowerCase()] ?? 99;
    const orderB = MATCH_WINNER_SORT[b.selection.toLowerCase()] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.selection.localeCompare(b.selection);
  });
}

function pricedOdds(odds: Odd[]): Odd[] {
  return odds.filter((o) => {
    const v = Number(o.odd_value);
    return Number.isFinite(v) && v > 0;
  });
}

function dedupeBySelection(odds: Odd[]): Odd[] {
  const selections = new Map<string, Odd>();
  for (const odd of odds) {
    if (!selections.has(odd.selection)) {
      selections.set(odd.selection, odd);
    }
  }
  return Array.from(selections.values());
}

function getDisplayOdds(odds: Odd[]) {
  return sortMatchWinnerSelections(dedupeBySelection(odds)).slice(0, 3);
}

/** Prefer 1X2; otherwise first market with at least two priced selections. */
export function getMatchWinnerDisplayOdds(odds: Odd[]) {
  if (!odds?.length) return [];
  const priced = pricedOdds(odds);
  const mw = getDisplayOdds(priced.filter(isMatchWinnerMarket));
  if (mw.length >= 2) return mw;

  const byMarket = new Map<string, Odd[]>();
  for (const o of priced) {
    const key = (o.market_key || o.market_name || 'other').toLowerCase();
    if (!byMarket.has(key)) byMarket.set(key, []);
    byMarket.get(key)!.push(o);
  }
  let best: Odd[] = [];
  for (const rows of byMarket.values()) {
    const line = dedupeBySelection(rows).slice(0, 3);
    if (line.length > best.length) best = line;
  }
  return best;
}

/** True when the UI can show at least two priced selections (any market). */
export function hasMatchWinnerOdds(odds: Odd[] | undefined): boolean {
  return getMatchWinnerDisplayOdds(odds || []).length >= 2;
}

/** Any stored odds row with a valid price. */
export function hasAnyStoredOdds(odds: Odd[] | undefined): boolean {
  return pricedOdds(odds || []).length > 0;
}
