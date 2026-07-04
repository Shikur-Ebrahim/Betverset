import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // This endpoint normally bundles fixtures, odds, meta, and topLeagues
    
    // 1. Fetch fixtures
    const now = new Date();
    const fixturesSnapshot = await db.collection('fixtures')
      .where('match_date', '>=', new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString())
      .orderBy('match_date', 'asc')
      .limit(limit)
      .get();
      
    const fixtures = fixturesSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    const fixtureIds = fixtures.map((f: any) => String(f.id));

    // 2. Build odds from embedded fields if available (fast path - zero DB reads for odds)
    const odds: Record<string, any[]> = {};
    fixtures.forEach((f: any) => {
      if (f.home_odds || f.draw_odds || f.away_odds) {
        const fid = String(f.id);
        odds[fid] = [
          { fixture_id: fid, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Home', odd_value: f.home_odds || null },
          { fixture_id: fid, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Draw', odd_value: f.draw_odds || null },
          { fixture_id: fid, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Away', odd_value: f.away_odds || null },
        ].filter(o => o.odd_value !== null);
      }
    });

    // 3. Top Leagues
    const leaguesSnapshot = await db.collection('leagues')
      .where('is_top', '==', true)
      .limit(15)
      .get();
    const topLeagues = leaguesSnapshot.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => (a.top_rank ?? 999) - (b.top_rank ?? 999));

    // 4. Meta (simplified for Firestore)
    const countriesMap = new Map();
    fixtures.forEach((f: any) => {
      const c = f.country_name || 'International';
      if (!countriesMap.has(c)) {
        countriesMap.set(c, { name: c, count: 0, flag_url: f.flag_url || null });
      }
      countriesMap.get(c).count++;
    });
    
    const countries = Array.from(countriesMap.values()).sort((a, b) => b.count - a.count);
    const total = fixtures.length;

    const meta = {
      total,
      days: [{ id: 'all', count: total }], // Simplified for now
      countries: [{ name: 'All countries', count: total, flag_url: null }, ...countries]
    };

    return NextResponse.json({
      fixtures,
      odds,
      meta,
      topLeagues
    });
  } catch (err: any) {
    console.error('[fixtures/bootstrap]', err);
    return NextResponse.json({
      fixtures: [],
      odds: {},
      meta: { total: 0, days: [], countries: [] },
      topLeagues: []
    });
  }
}

export const dynamic = 'force-dynamic';
