import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';
import { allocateUniqueTicketCode } from '@/lib/services/ticketCode';


// GET /api/admin/manual-tickets
export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { data: tickets, error } = await supabaseAdmin
      .from('bet_slips')
      .select('*')
      .eq('is_manual_preset', true)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json(tickets || []);
  } catch (err: any) {
    console.error('manual-tickets list:', err);
    return NextResponse.json({ message: 'Failed to list manual tickets' }, { status: 500 });
  }
}

type ManualMatchInput = {
  home_team_id: string;
  away_team_id: string;
  home_team_name?: string;
  away_team_name?: string;
  home_team_logo?: string | null;
  away_team_logo?: string | null;
  league_name?: string;
  selection: string;
  odd: number;
  market_name?: string;
  manual_kickoff_at: string;
  manual_end_at: string;
};

// POST /api/admin/manual-tickets
export async function POST(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const body = await req.json();
    const matches = body?.matches as ManualMatchInput[] | undefined;

    if (!Array.isArray(matches) || matches.length !== 3) {
      return NextResponse.json({ message: 'Provide exactly 3 matches' }, { status: 400 });
    }

    let totalOdds = 1;
    const selectionsToInsert: any[] = [];

    for (const m of matches) {
      const odd = parseFloat(String(m.odd));
      if (!Number.isFinite(odd) || odd < 1.01) {
        return NextResponse.json({ message: 'Invalid odd' }, { status: 400 });
      }

      const kick = new Date(m.manual_kickoff_at);
      const end = new Date(m.manual_end_at);
      if (isNaN(kick.getTime()) || isNaN(end.getTime()) || end <= kick) {
        return NextResponse.json({ message: 'Invalid kickoff or end time' }, { status: 400 });
      }

      const sel = String(m.selection || '').trim();
      if (!sel) {
        return NextResponse.json({ message: 'Selection required on each leg' }, { status: 400 });
      }

      if (String(m.home_team_id) === String(m.away_team_id)) {
        return NextResponse.json({ message: 'Each match needs two different team ids' }, { status: 400 });
      }

      const leagueLabel = m.league_name || 'Football';
      totalOdds *= odd;

      selectionsToInsert.push({
        selection: sel,
        odd,
        market_name: String(m.market_name || '1X2').trim() || '1X2',
        home_team: String(m.home_team_name || 'Home'),
        away_team: String(m.away_team_name || 'Away'),
        home_logo: m.home_team_logo || null,
        away_logo: m.away_team_logo || null,
        home_team_id: String(m.home_team_id),
        away_team_id: String(m.away_team_id),
        league_name: leagueLabel,
        is_manual: true,
        status: 'pending',
        manual_kickoff_at: kick.toISOString(),
        manual_end_at: end.toISOString(),
        is_manual_fixture: true,
        result: null,
        fixture_id: null,
      });
    }

    const ticketCode = await allocateUniqueTicketCode();
    const roundedOdds = Math.round(totalOdds * 10000) / 10000;

    const slipData = {
      user_id: null,
      total_odds: roundedOdds,
      stake: 0,
      potential_win: 0,
      status: 'pending',
      ticket_code: ticketCode,
      is_manual_preset: true,
      selections: selectionsToInsert,
      created_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabaseAdmin
      .from('bet_slips')
      .insert(slipData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      id: inserted.id,
      ticket_code: ticketCode,
      total_odds: roundedOdds,
      created_at: slipData.created_at,
    }, { status: 201 });
  } catch (err: any) {
    console.error('manual-tickets create:', err);
    return NextResponse.json({ message: 'Failed to create manual ticket' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
