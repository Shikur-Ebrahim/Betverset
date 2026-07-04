import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


// GET /api/live/matches
export async function GET() {
  try {
    const snapshot = await db.collection('live_matches')
      .where('is_active', '==', true)
      .get();

    const matches = await Promise.all(snapshot.docs
      .sort((a: any, b: any) => {
        const aDate = a.data().match_date || '';
        const bDate = b.data().match_date || '';
        return aDate.localeCompare(bDate);
      })
      .map(async (doc: any) => {
      const lm = doc.data();
      let fixtureData: any = {};

      if (lm.fixture_id) {
        const fixDoc = await db.collection('fixtures').doc(String(lm.fixture_id)).get();
        if (fixDoc.exists) fixtureData = fixDoc.data();
      }

      return {
        id: doc.id,
        ...lm,
        ...fixtureData,
      };
    }));

    return NextResponse.json(matches, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    console.error('Failed to fetch live matches:', err);
    return NextResponse.json({ error: 'Failed to fetch live matches' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
