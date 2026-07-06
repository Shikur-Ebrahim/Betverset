import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Main fixtures for today
    const { data: fixtures, error } = await supabaseAdmin
      .from('fixtures')
      .select('*')
      .like('match_date', `${today}%`)
      .order('kickoff_at', { ascending: true })
      .limit(50);

    if (error) throw error;

    // Live matches
    const { data: liveData } = await supabaseAdmin
      .from('fixtures')
      .select('*')
      .in('status', ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'])
      .order('kickoff_at', { ascending: false })
      .limit(10);

    // Format like Firebase structure
    const formatMatch = (doc: any) => ({
      id: doc.id,
      fixture: {
        id: doc.id,
        date: doc.kickoff_at,
        status: { short: doc.status, elapsed: doc.elapsed },
        referee: doc.referee,
        venue: { name: doc.venue_name, city: doc.venue_city }
      },
      teams: {
        home: { id: doc.home_team_id, name: doc.home_team_name, logo: doc.home_team_logo },
        away: { id: doc.away_team_id, name: doc.away_team_name, logo: doc.away_team_logo }
      },
      league: {
        id: doc.league_id,
        name: doc.league_name,
        logo: doc.league_logo,
        country: doc.country_name
      },
      goals: {
        home: doc.home_goals,
        away: doc.away_goals
      },
      ...doc.data
    });

    return NextResponse.json({
      matches: (fixtures || []).map(formatMatch),
      live: (liveData || []).map(formatMatch),
    });
  } catch (err: any) {
    console.error('fixtures/home err:', err);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
