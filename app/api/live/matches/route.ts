import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET /api/live/matches
export async function GET() {
  try {
    const { data: fixtures, error } = await supabaseAdmin
      .from('fixtures')
      .select('*')
      .in('status', ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'])
      .order('kickoff_at', { ascending: false });

    if (error) throw error;

    const formatted = (fixtures || []).map((doc: any) => ({
      id: doc.id,
      fixture_id: doc.id,
      match_date: doc.kickoff_at,
      status: doc.status,
      elapsed: doc.elapsed,
      home_team_id: doc.home_team_id,
      home_team_name: doc.home_team_name,
      away_team_id: doc.away_team_id,
      away_team_name: doc.away_team_name,
      home_goals: doc.home_goals,
      away_goals: doc.away_goals,
      fixture: {
        id: doc.id,
        date: doc.kickoff_at,
        status: { short: doc.status, elapsed: doc.elapsed },
      },
      teams: {
        home: { id: doc.home_team_id, name: doc.home_team_name, logo: doc.home_team_logo },
        away: { id: doc.away_team_id, name: doc.away_team_name, logo: doc.away_team_logo }
      },
      league: {
        id: doc.league_id,
        name: doc.league_name,
        logo: doc.league_logo,
      },
      goals: {
        home: doc.home_goals,
        away: doc.away_goals
      },
      ...doc.data
    }));

    return NextResponse.json(formatted, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    console.error('Failed to fetch live matches:', err);
    return NextResponse.json({ error: 'Failed to fetch live matches' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
