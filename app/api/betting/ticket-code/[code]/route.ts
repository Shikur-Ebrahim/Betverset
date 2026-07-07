import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function isFixturePreMatchOnly(status: string | null | undefined): boolean {
  if (!status) return false;
  return status === 'NS' || status === 'TBD';
}

function computeCanPlace(
  selectionsRaw: any[],
  fixturesMap: Map<string, { status: string | null }>
): { can_place: boolean; message: string | null } {
  const now = Date.now();

  for (const sel of selectionsRaw) {
    const fid = sel.fixture_id;
    if (fid != null && fid !== undefined) {
      const fixture = fixturesMap.get(String(fid));
      if (!fixture) {
        return { can_place: false, message: 'One or more matches could not be found.' };
      }
      if (!isFixturePreMatchOnly(fixture.status)) {
        return { can_place: false, message: 'The game has already started. You cannot place this bet.' };
      }
    } else {
      const mk = sel.manual_kickoff_at;
      if (!mk || Number.isNaN(new Date(mk).getTime())) {
        return { can_place: false, message: 'Invalid selection: missing fixture or manual kickoff time' };
      }
      if (now >= new Date(mk).getTime()) {
        return { can_place: false, message: 'The game has already started. You cannot place this bet.' };
      }
      const mend = sel.manual_end_at;
      if (mend && !Number.isNaN(new Date(mend).getTime()) && now >= new Date(mend).getTime()) {
        return { can_place: false, message: 'This ticket code has expired. All matches have finished.' };
      }
    }
  }

  return { can_place: true, message: null };
}

// GET /api/betting/ticket-code/[code]
export async function GET(req: Request, props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  const { code } = params;

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
    const isManualPreset = ticket.is_manual_preset === true;

    const selectionsRaw = ticket.selections || [];
    const neededFixtureIds = new Set<number>();
    
    selectionsRaw.forEach((bsel: any) => {
      if (!bsel.manual_kickoff_at && bsel.fixture_id) {
        neededFixtureIds.add(Number(bsel.fixture_id));
      }
    });

    const fixturesMap = new Map<string, { kickoff_at: string | null; status: string | null }>();
    const fixtureIdsArr = Array.from(neededFixtureIds);

    if (fixtureIdsArr.length > 0) {
      const { data: fixtureRows } = await supabaseAdmin
        .from('fixtures')
        .select('id, match_date, kickoff_at, status, data')
        .in('id', fixtureIdsArr);

      (fixtureRows || []).forEach((row: any) => {
        fixturesMap.set(String(row.id), {
          kickoff_at: row.match_date || row.kickoff_at || null,
          status: row.status || (row.data as any)?.fixture?.status?.short || null,
        });
      });
    }

    const selections = selectionsRaw.map((bsel: any) => {
      let kickoff_at = bsel.manual_kickoff_at;
      if (!kickoff_at && bsel.fixture_id) {
        kickoff_at = fixturesMap.get(String(bsel.fixture_id))?.kickoff_at ?? null;
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
        kickoff_at: kickoff_at || null,
        is_manual_fixture: bsel.is_manual_fixture,
        is_manual: bsel.is_manual === true || (bsel.fixture_id == null && !!bsel.manual_kickoff_at),
        manual_kickoff_at: bsel.manual_kickoff_at,
        manual_end_at: bsel.manual_end_at,
      };
    });

    const { can_place, message } = computeCanPlace(selectionsRaw, fixturesMap);

    return NextResponse.json({
      ticket_code: ticket.ticket_code,
      selections,
      is_manual_preset: isManualPreset,
      can_place,
      message,
    });
  } catch (err: any) {
    console.error('ticket-code err:', err);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
