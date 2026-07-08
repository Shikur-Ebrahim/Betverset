import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { filterFixturesWithOdds, loadMatchWinnerOddsForFixtures } from '@/lib/load-fixture-odds';
import { formatFixtureRows } from '@/lib/fixture-format';
import { MAX_TOTAL_MATCHES } from '@/lib/services/apiFootball';
import { siteDayBuckets, siteDayUtcRange, siteWindowRange, toSiteDateStr } from '@/lib/fixture-date-utils';

/** Build a day-bucketed meta object for the dropdown (UTC+3 site timezone). */
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

  // Build days array - only include days that have matches, always include 'all'
  const days = [
    { id: 'all', count: total },
    ...dayBuckets
      .filter((b) => (dayCounts.get(b.id) || 0) > 0)
      .map((b) => ({ id: b.id, count: dayCounts.get(b.id) || 0 })),
  ];

  // Build countries
  const countriesMap = new Map<string, { name: string; count: number; flag_url: string | null }>();
  for (const f of fixtures) {
    const c = f.country_name || 'International';
    if (!countriesMap.has(c)) {
      countriesMap.set(c, { name: c, count: 0, flag_url: f.flag_url || null });
    }
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

    const { start: cutoffDate, end: maxDate } = siteWindowRange();

    const { data: fixturesRows, error } = await supabaseAdmin
      .from('fixtures')
      .select('*')
      .gte('match_date', cutoffDate)
      .lte('match_date', maxDate)
      .order('match_date', { ascending: true })
      .limit(limit);

    if (error) throw error;

    const allFixtures = fixturesRows || [];
    const withOdds = await filterFixturesWithOdds(allFixtures);
    const fixtures = formatFixtureRows(withOdds);

    const odds = await loadMatchWinnerOddsForFixtures(fixtures);

    // Top leagues
    const { data: topLeaguesRows } = await supabaseAdmin
      .from('leagues')
      .select('*')
      .eq('is_top', true)
      .limit(15);

    const topLeagues = (topLeaguesRows || []).sort(
      (a: any, b: any) => (a.top_rank ?? 999) - (b.top_rank ?? 999)
    );

    const meta = buildMeta(fixtures);

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
