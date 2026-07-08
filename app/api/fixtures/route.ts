import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { filterFixturesWithOdds, loadMatchWinnerOddsForFixtures } from '@/lib/load-fixture-odds';
import { formatFixtureRows } from '@/lib/fixture-format';
import { MAX_TOTAL_MATCHES } from '@/lib/services/apiFootball';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');
    const day = searchParams.get('day');
    const country = searchParams.get('country');
    const apiLeagueId = searchParams.get('api_league_id');
    const hasOdds = searchParams.get('has_odds') === '1';
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(MAX_TOTAL_MATCHES), 10),
      MAX_TOTAL_MATCHES
    );

    const now = new Date();
    let query = supabaseAdmin.from('fixtures').select('*');

    if (dateStr) {
      query = query.like('match_date', `${dateStr}%`);
    } else if (day && day !== 'all') {
      let bucketDate: string;
      if (day === 'today') {
        bucketDate = now.toISOString().split('T')[0];
      } else if (day === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        bucketDate = tomorrow.toISOString().split('T')[0];
      } else if (day.startsWith('date:')) {
        bucketDate = day.replace('date:', '');
      } else {
        bucketDate = now.toISOString().split('T')[0];
      }
      query = query.like('match_date', `${bucketDate}%`);
    } else {
      const cutoffDate = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
      const maxDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('match_date', cutoffDate).lte('match_date', maxDate);
    }

    if (country) query = query.eq('country_name', country);
    if (apiLeagueId) query = query.eq('api_league_id', parseInt(apiLeagueId, 10));

    const { data: fixturesRows, error } = await query.order('match_date', { ascending: true }).limit(limit);
    if (error) throw error;

    let fixtures = formatFixtureRows(fixturesRows || []);
    if (hasOdds) {
      const filtered = await filterFixturesWithOdds(fixturesRows || []);
      const allowedIds = new Set(filtered.map((f) => f.id));
      fixtures = fixtures.filter((f) => allowedIds.has(f.id));
    }

    if (searchParams.get('include_odds') === '1') {
      const odds = await loadMatchWinnerOddsForFixtures(fixtures);
      return NextResponse.json({ fixtures, odds });
    }

    return NextResponse.json(fixtures);
  } catch (err: any) {
    console.error('fixtures list error:', err);
    return NextResponse.json({ message: 'Failed to fetch fixtures' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
