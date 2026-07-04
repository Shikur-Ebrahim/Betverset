import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET() {
  try {
    const snapshot = await db.collection('leagues').get();
      
    const leagues = snapshot.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => {
        // Top leagues first, then by rank, then alphabetically
        if ((a.is_top ? 1 : 0) !== (b.is_top ? 1 : 0)) return (b.is_top ? 1 : 0) - (a.is_top ? 1 : 0);
        if ((a.top_rank ?? 999) !== (b.top_rank ?? 999)) return (a.top_rank ?? 999) - (b.top_rank ?? 999);
        return (a.name || '').localeCompare(b.name || '');
      });
    return NextResponse.json(leagues);
  } catch (err: any) {
    console.error('Failed to fetch leagues:', err);
    return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
