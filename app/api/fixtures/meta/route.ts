import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { filterFixturesWithOdds } from '@/lib/load-fixture-odds';
import { buildFixtureMeta } from '@/lib/fixture-meta-build';
import { siteWindowRange } from '@/lib/fixture-date-utils';

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

    const meta = buildFixtureMeta(rows);
    return NextResponse.json(meta);
  } catch (err: any) {
    console.error('[fixtures/meta]', err);
    return NextResponse.json({
      total: 0,
      days: [{ id: 'all', count: 0 }],
      countries: [],
    });
  }
}

export const dynamic = 'force-dynamic';
