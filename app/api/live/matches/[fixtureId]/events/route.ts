import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


// GET /api/live/matches/[fixtureId]/events
export async function GET(req: Request, props: { params: Promise<{ fixtureId: string }> }) {
  const params = await props.params;
  try {
    const snapshot = await db.collection('live_events')
      .where('fixture_id', '==', params.fixtureId)
      .orderBy('minute', 'asc')
      .get();

    const events = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(events);
  } catch (err: any) {
    console.error('Failed to fetch live events:', err);
    return NextResponse.json({ error: 'Failed to fetch live events' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
