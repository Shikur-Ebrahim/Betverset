import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET(req: Request, props: { params: Promise<{ fixtureId: string }> }) {
  const params = await props.params;
  try {
    const snapshot = await db.collection('live_odds')
      .where('fixture_id', '==', params.fixtureId)
      .orderBy('updated_at', 'desc')
      .get();

    const liveOdds = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json(liveOdds);
  } catch (err: any) {
    console.error('Failed to fetch live odds:', err);
    return NextResponse.json({ error: 'Failed to fetch live odds' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
