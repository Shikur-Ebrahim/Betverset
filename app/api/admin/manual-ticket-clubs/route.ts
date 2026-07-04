import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


// GET /api/admin/manual-ticket-clubs
export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    // Fetch up to 100 recent matches from manual_ticket_matches
    const matchesSnap = await db.collection('manual_ticket_matches')
      .orderBy('saved_at', 'desc')
      .limit(100)
      .get();

    const matches = matchesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    const clubsMap = new Map();
    const leaguesMap = new Map();

    for (const match of matches) {
      // Add home team
      if (!clubsMap.has(match.home_team_id)) {
        clubsMap.set(match.home_team_id, {
          id: match.home_team_id,
          name: match.home_team_name,
          logo: match.home_team_logo,
          league_name: match.league_name,
          country_name: match.country_name,
          country_code: match.country_flag ? match.country_flag.split('/').pop()?.split('.')[0] : null,
        });
      }
      // Add away team
      if (!clubsMap.has(match.away_team_id)) {
        clubsMap.set(match.away_team_id, {
          id: match.away_team_id,
          name: match.away_team_name,
          logo: match.away_team_logo,
          league_name: match.league_name,
          country_name: match.country_name,
          country_code: match.country_flag ? match.country_flag.split('/').pop()?.split('.')[0] : null,
        });
      }
      // Add league
      if (!leaguesMap.has(match.league_id)) {
        leaguesMap.set(match.league_id, {
          id: match.league_id,
          league_name: match.league_name,
          country_name: match.country_name,
          flag_url: match.country_flag,
        });
      }
    }

    const clubs = Array.from(clubsMap.values());
    const small_leagues = Array.from(leaguesMap.values());

    return NextResponse.json({
      date: new Date().toISOString().slice(0, 10),
      clubs,
      small_leagues,
      matches, // Send matches to display in UI
    });
  } catch (err: any) {
    console.error('manual-ticket-clubs:', err);
    return NextResponse.json({ message: 'Failed to load clubs' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
