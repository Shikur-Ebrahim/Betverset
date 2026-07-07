import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Expand compact odds row (new format: 1 row per fixture with all markets in JSONB)
 * into flat Odd[] that the frontend expects.
 */
function expandCompactOdds(fixtureId: number, row: any): any[] {
  const m = row.markets;
  if (!m) return [];

  // New compact format: markets.flat_markets is an array of market objects
  if (Array.isArray(m.flat_markets)) {
    const out: any[] = [];
    for (const market of m.flat_markets) {
      for (const val of market.values || []) {
        out.push({
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
    return out;
  }

  // Old format: markets = { bookmaker, bet, value }
  if (m.bookmaker && m.bet && m.value) {
    return [{
      fixture_id: fixtureId,
      market_id: String(m.bet.id),
      market_name: m.bet.name || '',
      market_key: (m.bet.name || '').toLowerCase().replace(/\s+/g, '_'),
      bookmaker_id: String(m.bookmaker.id),
      bookmaker_name: m.bookmaker.name || '',
      selection: String(m.value.value || ''),
      odd_value: parseFloat(m.value.odd) || null,
    }];
  }

  return [];
}

export async function GET(req: Request, props: { params: Promise<{ fixtureId: string }> }) {
  const params = await props.params;
  try {
    const fixtureId = Number(params.fixtureId);
    if (!fixtureId || isNaN(fixtureId)) {
      return NextResponse.json([], { status: 400 });
    }

    const { data: oddsRows, error } = await supabaseAdmin
      .from('odds')
      .select('fixture_id, market_name, market_key, market_id, bookmaker_id, bookmaker_name, selection, odd_value, markets')
      .eq('fixture_id', fixtureId);

    if (error) throw error;
    if (!oddsRows || oddsRows.length === 0) {
      return NextResponse.json([]);
    }

    // Expand all rows into flat Odd[]
    const allOdds: any[] = [];
    for (const row of oddsRows) {
      // Check if it's a compact row (market_key === 'all_markets')
      if (row.market_key === 'all_markets' && row.markets?.flat_markets) {
        allOdds.push(...expandCompactOdds(fixtureId, row));
      } else if (row.odd_value !== null && row.selection && row.selection !== 'all') {
        // Regular per-odd row
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

    return NextResponse.json(allOdds);
  } catch (err: any) {
    console.error(`[odds/fixture/${params.fixtureId}] Error:`, err);
    return NextResponse.json([]);
  }
}

export const dynamic = 'force-dynamic';
