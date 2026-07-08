import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { filterFixturesWithOdds, loadMatchWinnerOddsForFixtures } from '@/lib/load-fixture-odds';
import { formatFixtureRows } from '@/lib/fixture-format';
import { buildFixtureMeta } from '@/lib/fixture-meta-build';
import { MAX_TOTAL_MATCHES } from '@/lib/services/apiFootball';
import { siteDayBuckets, siteDayUtcRange, siteWindowRange, toSiteDateStr } from '@/lib/fixture-date-utils';

function filterByDay(fixtures: any[], day: string | null) {
  if (!day || day === 'all') return fixtures;
  const buckets = siteDayBuckets();
  let bucketDate: string;
  if (day === 'today') bucketDate = buckets[0].date;
  else if (day === 'tomorrow') bucketDate = buckets[1]?.date ?? buckets[0].date;
  else if (day.startsWith('date:')) bucketDate = day.replace('date:', '');
  else return fixtures;

  return fixtures.filter((f) => toSiteDateStr(f.match_date || f.kickoff_at || '') === bucketDate);
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

    const { start, end } = siteWindowRange();

    const { data: fixturesRows, error } = await supabaseAdmin
      .from('fixtures')
      .select('*')
      .gte('match_date', start)
      .lte('match_date', end)
      .order('match_date', { ascending: true })
      .limit(limit);

    if (error) throw error;

    const allRows = fixturesRows || [];
    const withOdds = await filterFixturesWithOdds(allRows);
    const meta = buildFixtureMeta(withOdds);

    let scoped = withOdds;
    scoped = filterByDay(scoped, day);
    if (country) scoped = scoped.filter((f) => (f.country_name || 'International') === country);
    if (api_league_id) scoped = scoped.filter((f) => Number(f.api_league_id) === api_league_id);

    const fixtures = formatFixtureRows(scoped);
    const odds = await loadMatchWinnerOddsForFixtures(fixtures);

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
