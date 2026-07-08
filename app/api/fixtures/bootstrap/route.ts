import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { filterFixturesWithOdds, loadMatchWinnerOddsForFixtures } from '@/lib/load-fixture-odds';
import { formatFixtureRows } from '@/lib/fixture-format';
import { buildFixtureMeta } from '@/lib/fixture-meta-build';
import { MAX_TOTAL_MATCHES } from '@/lib/services/apiFootball';
import { siteWindowRange } from '@/lib/fixture-date-utils';

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
    const meta = buildFixtureMeta(withOdds);

    const { data: topLeaguesRows } = await supabaseAdmin
      .from('leagues')
      .select('*')
      .eq('is_top', true)
      .limit(15);

    const topLeagues = (topLeaguesRows || []).sort(
      (a: any, b: any) => (a.top_rank ?? 999) - (b.top_rank ?? 999)
    );

    return NextResponse.json({ fixtures, odds, meta, topLeagues });
  } catch (err: any) {
    console.error('[fixtures/bootstrap]', err);
    return NextResponse.json({
      fixtures: [],
      odds: {},
      meta: { total: 0, days: [{ id: 'all', count: 0 }], countries: [] },
      topLeagues: [],
    });
  }
}

export const dynamic = 'force-dynamic';
