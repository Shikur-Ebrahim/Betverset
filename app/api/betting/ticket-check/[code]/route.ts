import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request, props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  const { code } = params;

  if (!code) {
    return NextResponse.json({ message: 'Code is required' }, { status: 400 });
  }

  try {
    const { data: slips, error } = await supabaseAdmin
      .from('bet_slips')
      .select('*')
      .eq('ticket_code', code.toUpperCase())
      .limit(1);

    if (error) throw error;
    
    if (!slips || slips.length === 0) {
      return NextResponse.json({ message: 'Ticket not found' }, { status: 404 });
    }

    const ticket = slips[0];
    const selectionsRaw = ticket.selections || [];

    // Gather all unique fixture IDs needed
    const neededFixtureIds = new Set<number>();
    selectionsRaw.forEach((bsel: any) => {
      if (!bsel.manual_kickoff_at && bsel.fixture_id) {
        neededFixtureIds.add(Number(bsel.fixture_id));
      }
    });

    const fixturesMap = new Map<string, string>();
    const fixtureIdsArr = Array.from(neededFixtureIds);
    
    if (fixtureIdsArr.length > 0) {
      const { data: fixtureRows } = await supabaseAdmin
        .from('fixtures')
        .select('id, match_date, kickoff_at')
        .in('id', fixtureIdsArr);
      
      (fixtureRows || []).forEach((row: any) => {
        fixturesMap.set(String(row.id), row.match_date || row.kickoff_at);
      });
    }

    const selections = selectionsRaw.map((bsel: any) => {
      let kickoff_at = bsel.manual_kickoff_at;
      if (!kickoff_at && bsel.fixture_id) {
        kickoff_at = fixturesMap.get(String(bsel.fixture_id));
      }

      return {
        fixture_id: bsel.fixture_id,
        selection: bsel.selection,
        odd: bsel.odd,
        result: bsel.result,
        home_team: bsel.home_team,
        away_team: bsel.away_team,
        home_logo: bsel.home_logo,
        away_logo: bsel.away_logo,
        league_name: bsel.league_name,
        market_name: bsel.market_name,
        kickoff_at: kickoff_at || null
      };
    });

    return NextResponse.json({ ...ticket, possible_win: ticket.potential_win, selections });
  } catch (err: any) {
    console.error('ticket-check err:', err);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
