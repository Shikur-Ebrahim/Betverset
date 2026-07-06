import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { data: doc, error } = await supabaseAdmin.from('fixtures').select('*').eq('id', params.id).single();

    if (error || !doc) {
      return NextResponse.json({ message: 'Fixture not found' }, { status: 404 });
    }

    const formatted = {
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
    };

    return NextResponse.json(formatted);
  } catch (err: any) {
    console.error(`Error fetching fixture ${params.id}:`, err);
    return NextResponse.json({ message: 'Failed to fetch fixture' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
