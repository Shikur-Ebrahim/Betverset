import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET(req: Request, props: { params: Promise<{ fixtureId: string }> }) {
  const params = await props.params;
  try {
    const fixtureId = params.fixtureId;
    if (!fixtureId) {
      return NextResponse.json({ error: 'Invalid fixture id' }, { status: 400 });
    }

    const [oddsSnapshot, fixtureSnapshot] = await Promise.all([
      db.collection('odds').where('fixture_id', '==', fixtureId).get(),
      db.collection('fixtures').doc(fixtureId).get()
    ]);

    const odds = oddsSnapshot.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .filter((o: any) => o.odd_value != null && o.odd_value > 0);

    const fixtureData = fixtureSnapshot.data();
    if (fixtureData && (fixtureData.home_odds || fixtureData.draw_odds || fixtureData.away_odds)) {
      // Check if match winner odds already exist in the collection to prevent duplicates
      const hasMatchWinner = odds.some((o: any) => o.market_key === 'match_winner');
      if (!hasMatchWinner) {
        if (fixtureData.home_odds) odds.push({ fixture_id: fixtureId, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Home', odd_value: fixtureData.home_odds });
        if (fixtureData.draw_odds) odds.push({ fixture_id: fixtureId, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Draw', odd_value: fixtureData.draw_odds });
        if (fixtureData.away_odds) odds.push({ fixture_id: fixtureId, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Away', odd_value: fixtureData.away_odds });
      }
    }

    return NextResponse.json(odds, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (err: any) {
    console.error('Failed to fetch odds:', err);
    return NextResponse.json({ error: 'Failed to fetch odds' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
