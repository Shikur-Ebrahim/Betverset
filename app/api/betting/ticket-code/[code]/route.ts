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

function isFixturePreMatchOnly(status: string | null | undefined): boolean {
  if (!status) return false;
  return status === 'NS' || status === 'TBD';
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
    const selectionsRaw = data.selections || [];

    const now = Date.now();
    const selections = await Promise.all(selectionsRaw.map(async (r: any) => {
      const fid = r.fixture_id;
      let st = r.fixture_status;
      
      // Fetch current fixture status if available
      if (fid != null) {
        const fixDoc = await db.collection('fixtures').doc(String(fid)).get();
        if (fixDoc.exists) {
          st = fixDoc.data()?.status || st;
        }
      }

      const isManual = r.is_manual_fixture === true || (fid == null && r.manual_kickoff_at != null);
      let blocked = false;
      if (isManual) {
        const kick = r.manual_kickoff_at ? new Date(r.manual_kickoff_at).getTime() : NaN;
        blocked = !Number.isFinite(kick) || now >= kick;
      } else {
        const missing = fid == null;
        const prematch = !missing && isFixturePreMatchOnly(st);
        blocked = missing || !prematch;
      }
      return {
        fixture_id: fid,
        selection: r.selection,
        odd: parseFloat(String(r.odd)) || 1,
        home_team: r.home_team,
        away_team: r.away_team,
        home_logo: r.home_logo ?? '',
        away_logo: r.away_logo ?? '',
        league_name: r.league_name ?? '',
        market_name: r.market_name ?? 'General',
        fixture_status: st ?? (isManual ? 'MANUAL' : ''),
        manual_kickoff_at: r.manual_kickoff_at ? new Date(r.manual_kickoff_at).toISOString() : null,
        manual_end_at: r.manual_end_at ? new Date(r.manual_end_at).toISOString() : null,
        is_manual: isManual,
        blocked,
      };
    }));

    const anyBlocked = selections.some((s) => s.blocked);
    const allManualWithEnd =
      selections.length > 0 &&
      selections.every((s) => s.is_manual && s.manual_end_at != null && String(s.manual_end_at).length > 0);
    const allManualLegsFinished =
      allManualWithEnd &&
      selections.every((s) => {
        const t = new Date(s.manual_end_at as string).getTime();
        return Number.isFinite(t) && now >= t;
      });

    let message: string | null = null;
    if (allManualLegsFinished) {
      message = 'This ticket code has expired. All matches have finished.';
    } else if (anyBlocked) {
      message = 'The game has already started. You cannot place this bet.';
    }

    return NextResponse.json({
      ticket_code: code,
      selections,
      can_place: !anyBlocked && !allManualLegsFinished,
      message,
    });
  } catch (err: any) {
    console.error('Ticket code lookup error:', err);
    return NextResponse.json({ message: 'Failed to look up ticket' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
