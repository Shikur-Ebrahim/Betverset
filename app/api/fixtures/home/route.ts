import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { filterFixturesWithOdds, loadMatchWinnerOddsForFixtures } from '@/lib/load-fixture-odds';
import { formatFixtureRows } from '@/lib/fixture-format';
import { MAX_TOTAL_MATCHES } from '@/lib/services/apiFootball';

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
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(MAX_TOTAL_MATCHES), 10),
      MAX_TOTAL_MATCHES
    );
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
    const allFixtures = fixturesRows || [];
    const withOdds = await filterFixturesWithOdds(allFixtures);
    const fixtures = formatFixtureRows(withOdds);
    const odds = await loadMatchWinnerOddsForFixtures(fixtures);

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
