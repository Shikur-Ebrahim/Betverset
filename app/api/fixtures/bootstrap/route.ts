import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

    const { data: fixturesRows, error } = await supabaseAdmin
      .from('fixtures')
      .select('*')
      .gte('match_date', cutoffDate)
      .order('match_date', { ascending: true })
      .limit(limit);

    if (error) throw error;

    const fixtures = fixturesRows || [];

    // Build odds map: first try inline fields, then odds table
    const odds: Record<string, any[]> = {};
    fixtures.forEach((f: any) => {
      if (f.home_odds || f.draw_odds || f.away_odds) {
        const fid = String(f.id);
        const items = [
          { fixture_id: f.id, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Home', odd_value: f.home_odds || null },
          { fixture_id: f.id, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Draw', odd_value: f.draw_odds || null },
          { fixture_id: f.id, market_name: 'Match Winner', market_key: 'match_winner', selection: 'Away', odd_value: f.away_odds || null },
        ].filter((o) => o.odd_value !== null);
        if (items.length) odds[fid] = items;
      }
    });

    // Fetch match winner odds from odds table
    if (fixtures.length > 0) {
      const fixtureIds = fixtures.map((f: any) => f.id);
      const { data: oddsRows } = await supabaseAdmin
        .from('odds')
        .select('fixture_id, market_key, market_name, selection, odd_value')
        .in('fixture_id', fixtureIds.slice(0, 500))
        .like('market_key', '%match_winner%');

      if (oddsRows && oddsRows.length > 0) {
        for (const o of oddsRows) {
          const fid = String(o.fixture_id);
          if (!odds[fid]) odds[fid] = [];
          const exists = odds[fid].some((x: any) => x.selection === o.selection);
          if (!exists) {
            odds[fid].push({
              fixture_id: o.fixture_id,
              market_name: o.market_name,
              market_key: o.market_key,
              selection: o.selection,
              odd_value: o.odd_value,
            });
          }
        }
      }
    }

    // Top leagues
    const { data: topLeaguesRows } = await supabaseAdmin
      .from('leagues')
      .select('*')
      .eq('is_top', true)
      .limit(15);

    const topLeagues = (topLeaguesRows || []).sort((a: any, b: any) => (a.top_rank ?? 999) - (b.top_rank ?? 999));

    // Meta
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
      days: [{ id: 'all', count: total }],
      countries: [{ name: 'All countries', count: total, flag_url: null }, ...countries],
    };

    return NextResponse.json({ fixtures, odds, meta, topLeagues });
  } catch (err: any) {
    console.error('[fixtures/bootstrap]', err);
    return NextResponse.json({
      fixtures: [],
      odds: {},
      meta: { total: 0, days: [], countries: [] },
      topLeagues: [],
    });
  }
}

export const dynamic = 'force-dynamic';
