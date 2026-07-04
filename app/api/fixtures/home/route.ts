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

    const now = new Date();
    // Fetch recent and upcoming fixtures
    query = query.where('match_date', '>=', new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString());
    query = query.orderBy('match_date', 'asc').limit(limit);

    const snapshot = await query.get();

    const fixtures: any[] = [];
    const odds: Record<string, any[]> = {};

    snapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      
      // Filter in memory for parameters that don't have composite indexes
      if (country && country !== 'All countries' && data.country_name !== country) return;
      if (api_league_id && String(data.api_league_id) !== api_league_id) return;
      
      fixtures.push({ id: doc.id, ...data });

      // Build odds from embedded fields if available (fast path - no extra DB query)
      if (data.home_odds || data.draw_odds || data.away_odds) {
        const fid = String(doc.id);
        odds[fid] = [
          { fixture_id: fid, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Home', odd_value: data.home_odds || null },
          { fixture_id: fid, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Draw', odd_value: data.draw_odds || null },
          { fixture_id: fid, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Away', odd_value: data.away_odds || null },
        ].filter(o => o.odd_value !== null);
      }
    });

    return NextResponse.json({ fixtures, odds });
  } catch (err: any) {
    console.error('[fixtures/home]', err);
    return NextResponse.json({ fixtures: [], odds: {} });
  }
}

export const dynamic = 'force-dynamic';
