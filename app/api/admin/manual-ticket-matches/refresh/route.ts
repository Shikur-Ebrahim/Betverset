import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';

const API_KEY = process.env.FOOTBALL_API_KEY || '';
const API_HOST = process.env.API_FOOTBALL_HOST || 'v3.football.api-sports.io';
const API_BASE = `https://${API_HOST}`;

// Leagues to ignore (top leagues)
const TOP_LEAGUES = new Set([39, 2, 140, 135, 78, 61, 3, 848, 45, 40, 307, 253, 71, 88, 94]);

export async function POST(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    if (!API_KEY) throw new Error('API-Football Key is missing');

    // Fetch the next 99 matches to give us a good pool to filter from
    const res = await fetch(`${API_BASE}/fixtures?next=99`, {
      headers: { 'x-apisports-key': API_KEY },
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`API-Football error ${res.status}`);
    const json = await res.json();
    const data = json?.response || [];

    const batch = db.batch();
    let savedCount = 0;

    for (const item of data) {
      if (savedCount >= 50) break; // We only need 50 non-top matches per refresh

      const f = item?.fixture;
      const teams = item?.teams;
      const league = item?.league;

      if (!f?.id || !teams?.home?.id || !teams?.away?.id || !league?.id) continue;
      
      // Filter out top tier leagues to keep it "smaller leagues"
      if (TOP_LEAGUES.has(league.id)) continue;

      const ref = db.collection('manual_ticket_matches').doc(String(f.id));
      batch.set(ref, {
        api_fixture_id: f.id,
        match_date: f.date || null,
        home_team_id: String(teams.home.id),
        away_team_id: String(teams.away.id),
        home_team_name: teams.home.name || '',
        away_team_name: teams.away.name || '',
        home_team_logo: teams.home.logo || null,
        away_team_logo: teams.away.logo || null,
        league_id: league.id,
        league_name: league.name || '',
        country_name: league.country || '',
        country_flag: league.flag || null,
        saved_at: new Date().toISOString()
      }, { merge: true });

      savedCount++;
    }

    if (savedCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ message: 'Success', saved: savedCount });
  } catch (err: any) {
    console.error('Refresh manual ticket matches:', err);
    return NextResponse.json({ message: 'Failed to refresh matches', error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
