import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';
import { allocateUniqueTicketCode } from '@/lib/services/ticketCode';


function isFixturePreMatchOnly(status: string | null | undefined): boolean {
  if (!status) return false;
  return status === 'NS' || status === 'TBD';
}

export async function POST(req: Request) {
  const tokenUserId = await verifyUser(req);
  if (!tokenUserId) return unauthorized();

  try {
    const body = await req.json();
    const { user_id, selections, stake, enforce_prematch_from_ticket: enforcePrematchRaw } = body;

    // We can compare string IDs since we are migrating to Firebase Auth UIDs
    if (String(tokenUserId) !== String(user_id)) {
      return NextResponse.json({ message: 'Cannot place bet for another user' }, { status: 403 });
    }

    if (!user_id || !Array.isArray(selections) || selections.length === 0) {
      return NextResponse.json({ message: 'Invalid bet payload' }, { status: 400 });
    }

    const stakeNum = parseFloat(String(stake));
    if (!Number.isFinite(stakeNum) || stakeNum <= 0) {
      return NextResponse.json({ message: 'Invalid stake' }, { status: 400 });
    }

    const enforcePrematchFromTicket = enforcePrematchRaw === true || enforcePrematchRaw === 'true';

    if (enforcePrematchFromTicket) {
      for (const sel of selections) {
        const fid = sel.fixture_id;
        if (fid != null && fid !== undefined) {
          const fixtureDoc = await db.collection('fixtures').doc(String(fid)).get();
          if (!fixtureDoc.exists) {
            return NextResponse.json({ message: 'One or more matches could not be found.' }, { status: 400 });
          }
          if (!isFixturePreMatchOnly(fixtureDoc.data()?.status)) {
            return NextResponse.json({ message: 'The game has already started. You cannot place this bet.' }, { status: 400 });
          }
        } else {
          const mk = sel.manual_kickoff_at;
          if (!mk || Number.isNaN(new Date(mk).getTime())) {
            return NextResponse.json({ message: 'Invalid selection: missing fixture or manual kickoff time' }, { status: 400 });
          }
          if (Date.now() >= new Date(mk).getTime()) {
            return NextResponse.json({ message: 'The game has already started. You cannot place this bet.' }, { status: 400 });
          }
          const mend = sel.manual_end_at;
          if (mend && !Number.isNaN(new Date(mend).getTime()) && Date.now() >= new Date(mend).getTime()) {
            return NextResponse.json({ message: 'This ticket code has expired. All matches have finished.' }, { status: 400 });
          }
        }
      }
    }

    const resultData = await db.runTransaction(async (transaction: any) => {
      const userRef = db.collection('users').doc(tokenUserId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const balance = Number(userDoc.data()?.balance) || 0;
      if (balance < stakeNum) {
        throw new Error(`Insufficient balance. You have ${balance.toFixed(2)} but stake is ${stakeNum.toFixed(2)}.`);
      }

      transaction.update(userRef, { balance: balance - stakeNum });

      const ticketCode = await allocateUniqueTicketCode();
      const totalOdds = selections.reduce((acc: number, s: any) => acc * (parseFloat(String(s.odd)) || 1), 1);
      const possibleWin = stakeNum * totalOdds;

      const slipRef = db.collection('bet_slips').doc();
      
      const processedSelections = selections.map((sel: any, index: number) => {
        const isManual = sel.fixture_id == null && !!sel.manual_kickoff_at;
        return {
          id: index, // or generate uuid
          fixture_id: sel.fixture_id || null,
          market_id: sel.market_id || null,
          selection: sel.selection || 'N/A',
          odd: sel.odd || 1.0,
          home_team: sel.home_team || 'Unknown',
          away_team: sel.away_team || 'Unknown',
          home_logo: sel.home_logo || null,
          away_logo: sel.away_logo || null,
          league_name: sel.league_name || 'General',
          market_name: sel.market_name || 'General',
          manual_kickoff_at: sel.manual_kickoff_at || null,
          manual_end_at: sel.manual_end_at || null,
          is_manual_fixture: isManual,
          result: null
        };
      });

      const slipData = {
        id: slipRef.id,
        user_id: tokenUserId,
        total_odds: totalOdds,
        stake: stakeNum,
        possible_win: possibleWin,
        status: 'pending',
        ticket_code: ticketCode,
        selections: processedSelections,
        created_at: new Date().toISOString()
      };

      transaction.set(slipRef, slipData);

      return {
        ...slipData,
        wallet_balance: balance - stakeNum,
        currency: userDoc.data()?.currency || 'ETB'
      };
    });

    return NextResponse.json(resultData, { status: 201 });
  } catch (err: any) {
    console.error('Bet placement error:', err);
    return NextResponse.json({ message: err.message || 'Failed to place bet. Please check your selections and try again.' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
