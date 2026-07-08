import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { filterFixturesWithOdds, loadMatchWinnerOddsForFixtures } from '@/lib/load-fixture-odds';
import { formatFixtureRows } from '@/lib/fixture-format';
import { MAX_TOTAL_MATCHES } from '@/lib/services/apiFootball';
import { siteDayBuckets, siteDayUtcRange, siteWindowRange, toSiteDateStr } from '@/lib/fixture-date-utils';

function buildMeta(fixtures: any[]) {
  const dayBuckets = siteDayBuckets();
  const dayCounts = new Map<string, number>();
  let total = 0;
  for (const f of fixtures) {
    const matchDate = toSiteDateStr(f.match_date || f.kickoff_at || '');
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
      const buckets = siteDayBuckets(now);
      if (day === 'today') {
        dateStr = buckets[0].date;
      } else if (day === 'tomorrow') {
        dateStr = buckets[1]?.date ?? buckets[0].date;
      } else if (day.startsWith('date:')) {
        dateStr = day.replace('date:', '');
      } else {
        dateStr = buckets[0].date;
      }
      const { start, end } = siteDayUtcRange(dateStr);
      query = query.gte('match_date', start).lte('match_date', end);
    } else {
      const { start, end } = siteWindowRange(now);
      query = query.gte('match_date', start).lte('match_date', end);
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
