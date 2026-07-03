import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const day = searchParams.get('day');
    const country = searchParams.get('country');
    const api_league_id = searchParams.get('api_league_id');

    let query: any = db.collection('fixtures');

    // To properly support this in Firestore without a complex composite index, 
    // we may need to fetch and filter, or create specific indexes.
    // For migration purposes, we will query upcoming fixtures.
    const now = new Date();
    // Simplified: fetch recent and upcoming
    query = query.where('match_date', '>=', new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString());
    query = query.orderBy('match_date', 'asc').limit(limit);

    const snapshot = await query.get();

    const fixtures: any[] = [];
    const odds: Record<string, any[]> = {};
    const fixtureIds: string[] = [];

    snapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      
      // Filter in memory for parameters that don't have composite indexes yet
      if (country && country !== 'All countries' && data.country_name !== country) return;
      if (api_league_id && String(data.api_league_id) !== api_league_id) return;
      
      fixtures.push({ id: doc.id, ...data });
      fixtureIds.push(doc.id);
    });

    // Fetch odds for these fixtures
    if (fixtureIds.length > 0) {
      // In a real scenario, this would be optimized, e.g. with subcollections or batched 'in' queries
      // We chunk the fixtureIds into arrays of 10 for 'in' queries
      const chunks: string[][] = [];
      for (let i = 0; i < fixtureIds.length; i += 10) {
        chunks.push(fixtureIds.slice(i, i + 10));
      }

      await Promise.all(chunks.map(async (chunk) => {
        const oddsSnapshot = await db.collection('odds')
          .where('fixture_id', 'in', chunk)
          .get();
          
        oddsSnapshot.docs.forEach((doc: any) => {
          const oddData = doc.data();
          const fid = String(oddData.fixture_id);
          if (!odds[fid]) odds[fid] = [];
          odds[fid].push({ id: doc.id, ...oddData });
        });
      }));
    }

    return NextResponse.json({ fixtures, odds });
  } catch (err: any) {
    console.error('[fixtures/home]', err);
    return NextResponse.json({ fixtures: [], odds: {} });
  }
}

export const dynamic = 'force-dynamic';
