import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';


export async function GET(req: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const tokenUserId = await verifyUser(req);
  if (!tokenUserId) return unauthorized();

  const requestedUserId = params.userId;
  if (tokenUserId !== requestedUserId) {
    return NextResponse.json({ message: 'Cannot view another user’s bet history' }, { status: 403 });
  }

  try {
    const slipsRef = db.collection('bet_slips');
    const snapshot = await slipsRef
      .where('user_id', '==', requestedUserId)
      .orderBy('created_at', 'desc')
      .get();

    const history = await Promise.all(snapshot.docs.map(async (doc: any) => {
      const data = doc.data();
      const selectionsRaw = data.selections || [];

      // We need to map selections to format expected by frontend
      const selections = await Promise.all(selectionsRaw.map(async (bsel: any) => {
        let kickoff_at = bsel.manual_kickoff_at;
        
        if (!kickoff_at && bsel.fixture_id) {
          const fixDoc = await db.collection('fixtures').doc(String(bsel.fixture_id)).get();
          if (fixDoc.exists) {
            kickoff_at = fixDoc.data()?.match_date;
          }
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
      }));

      return {
        id: doc.id,
        ...data,
        selections
      };
    }));

    return NextResponse.json(history);
  } catch (err: any) {
    console.error('Bet history error:', err);
    return NextResponse.json({ message: 'Failed to fetch bet history' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
