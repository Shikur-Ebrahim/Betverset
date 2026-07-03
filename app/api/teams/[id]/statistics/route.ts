import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const snapshot = await db.collection('team_statistics')
      .where('team_id', '==', parseInt(params.id, 10))
      // .orderBy('season_year', 'desc') // Requires composite index if querying by equality then sorting by different field
      .get();
      
    // Sort in memory to avoid needing complex indexes for this migration
    const stats = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => (b.season_year || 0) - (a.season_year || 0));

    return NextResponse.json(stats);
  } catch (err: any) {
    console.error('Failed to fetch team statistics:', err);
    return NextResponse.json({ error: 'Failed to fetch team statistics' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
