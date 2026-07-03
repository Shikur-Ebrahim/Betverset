import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET() {
  try {
    const snapshot = await db.collection('bet_markets')
      .orderBy('name', 'asc')
      .get();

    const markets = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(markets);
  } catch (err: any) {
    console.error('Failed to fetch markets:', err);
    return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
