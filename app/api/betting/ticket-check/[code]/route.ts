import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


function normalizeTicketCodeParam(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^#/i, '')
    .replace(/^code:\s*/i, '')
    .trim()
    .toUpperCase();
}

export async function GET(req: Request, props: { params: Promise<{ code: string }> }) {
  const params = await props.params;
  const code = normalizeTicketCodeParam(params.code);
  if (!code) {
    return NextResponse.json({ message: 'Enter a ticket code' }, { status: 400 });
  }

  try {
    const slipsRef = db.collection('bet_slips');
    const snapshot = await slipsRef.where('ticket_code', '==', code).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json({ message: 'No ticket found for this code' }, { status: 404 });
    }

    const slipDoc = snapshot.docs[0];
    const data = slipDoc.data();

    // Map selections to the format expected by the frontend
    const selections = (data.selections || []).map((bsel: any) => ({
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
      kickoff_at: bsel.manual_kickoff_at || bsel.match_date // Frontend expects kickoff_at
    }));

    return NextResponse.json({
      id: slipDoc.id,
      ticket_code: data.ticket_code,
      stake: data.stake,
      total_odds: data.total_odds,
      possible_win: data.possible_win,
      status: data.status,
      created_at: data.created_at,
      selections
    });
  } catch (err: any) {
    console.error('Ticket check error:', err);
    return NextResponse.json({ message: 'Failed to look up ticket' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
