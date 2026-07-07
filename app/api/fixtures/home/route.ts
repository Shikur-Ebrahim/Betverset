import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function buildMeta(fixtures: any[]) {
  const now = new Date();
  const dayBuckets: { id: string; date: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const id = i === 0 ? 'today' : i === 1 ? 'tomorrow' : `date:${dateStr}`;
    dayBuckets.push({ id, date: dateStr });
  }

  const dayCounts = new Map<string, number>();
  let total = 0;
  for (const f of fixtures) {
    const matchDate = (f.match_date || f.kickoff_at || '').split('T')[0];
    if (!matchDate) continue;
    for (const bucket of dayBuckets) {
      if (matchDate === bucket.date) {
        dayCounts.set(bucket.id, (dayCounts.get(bucket.id) || 0) + 1);
        break;
      }
    }
    total++;
  }

  const days = [
    { id: 'all', count: total },
    ...dayBuckets
      .filter((b) => (dayCounts.get(b.id) || 0) > 0)
      .map((b) => ({ id: b.id, count: dayCounts.get(b.id) || 0 })),
  ];

  const countriesMap = new Map<string, { name: string; count: number; flag_url: string | null }>();
  for (const f of fixtures) {
    const c = f.country_name || 'International';
    if (!countriesMap.has(c)) countriesMap.set(c, { name: c, count: 0, flag_url: f.flag_url || null });
    countriesMap.get(c)!.count++;
  }
  const countries = [
    { name: 'All countries', count: total, flag_url: null },
    ...Array.from(countriesMap.values()).sort((a, b) => b.count - a.count),
  ];

  return { total, days, countries };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const day = searchParams.get('day') || null;
    const country = searchParams.get('country') || null;
    const api_league_id = searchParams.get('api_league_id')
      ? parseInt(searchParams.get('api_league_id')!, 10)
      : null;

    const now = new Date();
    let query = supabaseAdmin.from('fixtures').select('*');

    if (day && day !== 'all') {
      let dateStr: string;
      if (day === 'today') {
        dateStr = now.toISOString().split('T')[0];
      } else if (day === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateStr = tomorrow.toISOString().split('T')[0];
      } else if (day.startsWith('date:')) {
        dateStr = day.replace('date:', '');
      } else {
        dateStr = now.toISOString().split('T')[0];
      }
      query = query.like('match_date', `${dateStr}%`);
    } else {
      // Default: 2 hours ago → 7 days ahead
      const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
      const maxDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('match_date', cutoff).lte('match_date', maxDate);
    }

    if (country) query = query.eq('country_name', country);
    if (api_league_id) query = query.eq('api_league_id', api_league_id);

    const { data: fixturesRows, error } = await query
      .order('match_date', { ascending: true })
      .limit(limit);

    if (error) throw error;
    const fixtures = fixturesRows || [];

    // Build odds
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

    if (fixtures.length > 0) {
      const fixtureIds = fixtures.map((f: any) => f.id);
      const { data: oddsRows } = await supabaseAdmin
        .from('odds')
        .select('fixture_id, market_key, market_name, selection, odd_value')
        .in('fixture_id', fixtureIds.slice(0, 500))
        .like('market_key', '%match_winner%');

      if (oddsRows) {
        for (const o of oddsRows) {
          const fid = String(o.fixture_id);
          if (!odds[fid]) odds[fid] = [];
          if (!odds[fid].some((x: any) => x.selection === o.selection)) {
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

    const meta = buildMeta(fixtures);
    return NextResponse.json({ fixtures, odds, meta });
  } catch (err: any) {
    console.error('[fixtures/home]', err);
    return NextResponse.json(
      { fixtures: [], odds: {}, meta: { total: 0, days: [], countries: [] } },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
