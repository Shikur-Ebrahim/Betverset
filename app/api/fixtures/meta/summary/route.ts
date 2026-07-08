import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { filterFixturesWithOdds } from '@/lib/load-fixture-odds';
import { siteDayBuckets, siteWindowRange, toSiteDateStr } from '@/lib/fixture-date-utils';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const hasOdds = searchParams.get('has_odds') === '1';
    const { start, end } = siteWindowRange();

    const { data: fixtures, error } = await supabaseAdmin
      .from('fixtures')
      .select('*')
      .gte('match_date', start)
      .lte('match_date', end)
      .order('match_date', { ascending: true });

    if (error) throw error;

    let rows = fixtures || [];
    if (hasOdds) {
      rows = await filterFixturesWithOdds(rows);
    }

    const dayBuckets = siteDayBuckets();
    const dayCounts = new Map<string, number>();
    let total = 0;

    for (const f of rows) {
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
    for (const f of rows) {
      const c = f.country_name || 'International';
      if (!countriesMap.has(c)) {
        countriesMap.set(c, { name: c, count: 0, flag_url: f.flag_url || null });
      }
      countriesMap.get(c)!.count++;
    }

    const countries = Array.from(countriesMap.values()).sort((a, b) => b.count - a.count);

    return NextResponse.json({ total, days, countries });
  } catch (err: any) {
    console.error('[fixtures/meta/summary]', err);
    return NextResponse.json({
      total: 0,
      days: [],
      countries: [],
    });
  }
}

export const dynamic = 'force-dynamic';
