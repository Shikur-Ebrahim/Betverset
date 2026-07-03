import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET() {
  try {
    const snapshot = await db.collection('leagues')
      .where('is_top', '==', true)
      .orderBy('top_rank', 'asc')
      .get();
      
    const leagues = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(leagues);
  } catch (err: any) {
    console.error('Failed to fetch top leagues:', err);
    return NextResponse.json({ error: 'Failed to fetch top leagues' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
