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
    // Fetch non-top-league teams with logos
    const teamsSnap = await db.collection('teams')
      .where('logo', '!=', '')
      .limit(200)
      .get();

    // Fetch non-top leagues
    const leaguesSnap = await db.collection('leagues')
      .where('is_top', '==', false)
      .orderBy('name', 'asc')
      .limit(400)
      .get();

    const small_leagues = leaguesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    // Filter teams that belong to non-top leagues
    const topLeagueIds = new Set<string>();
    const allLeaguesSnap = await db.collection('leagues').where('is_top', '==', true).get();
    allLeaguesSnap.docs.forEach((d: any) => topLeagueIds.add(d.id));

    const clubs = teamsSnap.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .filter((t: any) => t.name && t.name.trim() && !topLeagueIds.has(String(t.league_id)))
      .slice(0, 20);

    return NextResponse.json({
      date: new Date().toISOString().slice(0, 10),
      clubs,
      small_leagues,
    });
  } catch (err: any) {
    console.error('manual-ticket-clubs:', err);
    return NextResponse.json({ message: 'Failed to load clubs' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
