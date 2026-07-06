import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request, props: { params: Promise<{ fixtureId: string }> }) {
  const params = await props.params;
  try {
    const fixtureId = Number(params.fixtureId);
    if (!fixtureId || isNaN(fixtureId)) {
      return NextResponse.json({ message: 'Invalid fixture ID' }, { status: 400 });
    }

    const { data: oddsRows, error } = await supabaseAdmin
      .from('odds')
      .select('markets')
      .eq('fixture_id', fixtureId);

    if (error) throw error;
    if (!oddsRows || oddsRows.length === 0) {
      return NextResponse.json({ message: 'Odds not found' }, { status: 404 });
    }

    // Reconstruct the response structure expected by frontend
    const responseData = [
      {
        fixture: { id: fixtureId },
        bookmakers: [] as any[]
      }
    ];

    const bookmakersMap = new Map<string, any>();

    oddsRows.forEach((row: any) => {
      const m = row.markets;
      if (!m || !m.bookmaker) return;
      
      const bmId = String(m.bookmaker.id);
      if (!bookmakersMap.has(bmId)) {
        bookmakersMap.set(bmId, {
          id: m.bookmaker.id,
          name: m.bookmaker.name,
          bets: []
        });
      }
      
      const bm = bookmakersMap.get(bmId);
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

    responseData[0].bookmakers = Array.from(bookmakersMap.values());

    return NextResponse.json(responseData);
  } catch (err: any) {
    console.error(`Error fetching odds for ${params.fixtureId}:`, err);
    return NextResponse.json({ message: 'Failed to fetch odds' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
