import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { fixtureIds } = await req.json();

    if (!Array.isArray(fixtureIds) || fixtureIds.length === 0) {
      return NextResponse.json({ message: 'Invalid fixtureIds array' }, { status: 400 });
    }

    const numericIds = fixtureIds.map(id => Number(id)).filter(id => !isNaN(id));
    if (numericIds.length === 0) {
      return NextResponse.json({ message: 'No valid fixture IDs provided' }, { status: 400 });
    }

    const { data: oddsRows, error } = await supabaseAdmin
      .from('odds')
      .select('fixture_id, markets')
      .in('fixture_id', numericIds);

    if (error) throw error;
    if (!oddsRows || oddsRows.length === 0) {
      return NextResponse.json({});
    }

    const result: Record<string, any[]> = {};

    oddsRows.forEach((row: any) => {
      const fid = String(row.fixture_id);
      if (!result[fid]) {
        result[fid] = [];
      }
      
      const m = row.markets;
      if (!m || !m.bookmaker) return;

      const bmId = String(m.bookmaker.id);
      let bmIndex = result[fid].findIndex((b: any) => String(b.id) === bmId);
      
      if (bmIndex === -1) {
        result[fid].push({
          id: m.bookmaker.id,
          name: m.bookmaker.name,
          bets: []
        });
        bmIndex = result[fid].length - 1;
      }

      const bm = result[fid][bmIndex];
      let bet = bm.bets.find((b: any) => String(b.id) === String(m.bet.id));
      if (!bet) {
        bet = {
          id: m.bet.id,
          name: m.bet.name,
          values: []
        };
        bm.bets.push(bet);
      }
      
      if (!bet.values.find((v: any) => v.value === m.value.value)) {
        bet.values.push(m.value);
      }
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Bulk odds fetch error:', err);
    return NextResponse.json({ message: 'Failed to fetch bulk odds' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
