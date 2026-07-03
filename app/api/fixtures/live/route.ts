import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET(req: Request) {
  try {
    const snapshot = await db.collection('fixtures')
      .where('status', 'in', ['1H', '2H', 'HT', 'ET', 'P', 'LIVE'])
      .orderBy('match_date', 'asc')
      .get();
      
    const fixtures = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json(fixtures);
  } catch (err: any) {
    console.error('Failed to fetch live matches:', err);
    return NextResponse.json({ error: 'Failed to fetch live matches' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
