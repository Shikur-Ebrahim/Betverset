import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET(req: Request, props: { params: Promise<{ fixtureId: string }> }) {
  const params = await props.params;
  try {
    const fixtureId = params.fixtureId;
    if (!fixtureId) {
      return NextResponse.json({ error: 'Invalid fixture id' }, { status: 400 });
    }

    const snapshot = await db.collection('odds')
      .where('fixture_id', '==', fixtureId)
      .get();

    const odds = snapshot.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .filter((o: any) => o.odd_value != null && o.odd_value > 0);

    return NextResponse.json(odds, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (err: any) {
    console.error('Failed to fetch odds:', err);
    return NextResponse.json({ error: 'Failed to fetch odds' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
