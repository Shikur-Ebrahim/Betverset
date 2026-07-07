import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';


export async function GET(req: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const tokenUserId = await verifyUser(req);
  if (!tokenUserId) return unauthorized();

  const requestedUserId = params.userId;
  if (tokenUserId !== requestedUserId) {
    return NextResponse.json({ message: 'Cannot view another user\'s bet history' }, { status: 403 });
  }

  try {
    const { data: slips, error } = await supabaseAdmin
      .from('bet_slips')
      .select('*')
      .eq('user_id', requestedUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const history = await Promise.all((slips || []).map(async (slip: any) => {
      const selectionsRaw = slip.selections || [];

      // Gather all unique fixture IDs needed
      const neededFixtureIds = new Set<number>();
      selectionsRaw.forEach((bsel: any) => {
        if (!bsel.manual_kickoff_at && bsel.fixture_id) {
          neededFixtureIds.add(Number(bsel.fixture_id));
        }
      });

      // Fetch all needed fixtures in chunks
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

      return { ...slip, possible_win: slip.potential_win, selections };
    }));

    return NextResponse.json(history);
  } catch (err: any) {
    console.error('Bet history error:', err);
    return NextResponse.json({ message: 'Failed to fetch bet history' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
