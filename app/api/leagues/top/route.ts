import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET() {
  try {
    const snapshot = await db.collection('leagues')
      .where('is_top', '==', true)
      .get();
      
    const leagues = snapshot.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => (a.top_rank ?? 999) - (b.top_rank ?? 999));
    return NextResponse.json(leagues);
  } catch (err: any) {
    console.error('Failed to fetch top leagues:', err);
    return NextResponse.json({ error: 'Failed to fetch top leagues' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
