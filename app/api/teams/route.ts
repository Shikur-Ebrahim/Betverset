import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const league_id = searchParams.get('league_id');

    let query: any = db.collection('teams');

    if (league_id) {
      query = query.where('league_id', '==', parseInt(league_id, 10));
    }

    const snapshot = await query.orderBy('name', 'asc').get();
    const teams = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json(teams);
  } catch (err: any) {
    console.error('Failed to fetch teams:', err);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
