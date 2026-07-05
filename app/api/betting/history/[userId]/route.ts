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
      .get();

    let docs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    docs.sort((a: any, b: any) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });

    const history = await Promise.all(docs.map(async (data: any) => {
      const selectionsRaw = data.selections || [];

      // Gather all unique fixture IDs needed
      const neededFixtureIds = new Set<string>();
      selectionsRaw.forEach((bsel: any) => {
        if (!bsel.manual_kickoff_at && bsel.fixture_id) {
          neededFixtureIds.add(String(bsel.fixture_id));
        }
      });

      // Fetch all needed fixtures in one query (or chunks of 10)
      const fixturesMap = new Map<string, string>();
      const fixtureIdsArr = Array.from(neededFixtureIds);
      
      if (fixtureIdsArr.length > 0) {
        const chunks: string[][] = [];
        for (let i = 0; i < fixtureIdsArr.length; i += 10) {
          chunks.push(fixtureIdsArr.slice(i, i + 10));
        }
        
        await Promise.all(chunks.map(async (chunk) => {
          const snap = await db.collection('fixtures').where('__name__', 'in', chunk).get();
          snap.docs.forEach((doc: any) => {
            fixturesMap.set(doc.id, doc.data().match_date);
          });
        }));
      }

      // We need to map selections to format expected by frontend
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

      return {
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
