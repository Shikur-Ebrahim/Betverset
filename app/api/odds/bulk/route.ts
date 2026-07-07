import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/** Expand a compact odds row (1 per fixture) into flat Odd[] */
function expandRow(row: any): any[] {
  const fixtureId = row.fixture_id;
  const m = row.markets;
  if (!m) return [];

  // New compact format
  if (Array.isArray(m.flat_markets)) {
    const out: any[] = [];
    for (const market of m.flat_markets) {
      for (const val of market.values || []) {
        if (!val.odd || val.odd <= 0) continue;
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

  // Legacy per-odd-value format
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

/** GET /api/odds/bulk?ids=1234,5678 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get('ids') || '';
    const numericIds = idsParam
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => Number.isFinite(n) && n > 0)
      .slice(0, 120);

    if (numericIds.length === 0) return NextResponse.json({});

    const { data: oddsRows, error } = await supabaseAdmin
      .from('odds')
      .select('fixture_id, market_name, market_key, market_id, bookmaker_id, bookmaker_name, selection, odd_value, markets')
      .in('fixture_id', numericIds);

    if (error) throw error;
    if (!oddsRows || oddsRows.length === 0) return NextResponse.json({});

    const result: Record<string, any[]> = {};
    for (const row of oddsRows) {
      const fid = String(row.fixture_id);
      if (!result[fid]) result[fid] = [];

      if (row.market_key === 'all_markets' && row.markets?.flat_markets) {
        result[fid].push(...expandRow(row));
      } else if (row.odd_value !== null && row.selection && row.selection !== 'all') {
        result[fid].push({
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

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[odds/bulk GET]', err);
    return NextResponse.json({});
  }
}

/** POST /api/odds/bulk  { fixtureIds: number[] } */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fixtureIds: number[] = (body?.fixtureIds || [])
      .map((id: any) => Number(id))
      .filter((n: number) => Number.isFinite(n) && n > 0)
      .slice(0, 120);

    if (fixtureIds.length === 0) return NextResponse.json({});

    const { data: oddsRows, error } = await supabaseAdmin
      .from('odds')
      .select('fixture_id, market_name, market_key, market_id, bookmaker_id, bookmaker_name, selection, odd_value, markets')
      .in('fixture_id', fixtureIds);

    if (error) throw error;
    if (!oddsRows || oddsRows.length === 0) return NextResponse.json({});

    const result: Record<string, any[]> = {};
    for (const row of oddsRows) {
      const fid = String(row.fixture_id);
      if (!result[fid]) result[fid] = [];

      if (row.market_key === 'all_markets' && row.markets?.flat_markets) {
        result[fid].push(...expandRow(row));
      } else if (row.odd_value !== null && row.selection && row.selection !== 'all') {
        result[fid].push({
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

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[odds/bulk POST]', err);
    return NextResponse.json({});
  }
}

export const dynamic = 'force-dynamic';
