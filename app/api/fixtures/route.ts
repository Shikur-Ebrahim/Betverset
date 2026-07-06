import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');

    let query = supabaseAdmin.from('fixtures').select('*').order('kickoff_at', { ascending: true });

    if (dateStr) {
      query = query.like('match_date', `${dateStr}%`);
    } else {
      const today = new Date().toISOString().split('T')[0];
      query = query.like('match_date', `${today}%`);
    }

    const { data: fixtures, error } = await query;
    if (error) throw error;
    
    // Format to match old Firebase structure
    const formatted = (fixtures || []).map((doc: any) => ({
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
      ...doc.data // Include raw data if needed
    }));

    return NextResponse.json(formatted);
  } catch (err: any) {
    console.error('fixtures list error:', err);
    return NextResponse.json({ message: 'Failed to fetch fixtures' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
