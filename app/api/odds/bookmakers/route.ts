import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET() {
  try {
    const snapshot = await db.collection('bookmakers')
      .orderBy('name', 'asc')
      .get();

    const bookmakers = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(bookmakers);
  } catch (err: any) {
    console.error('Failed to fetch bookmakers:', err);
    return NextResponse.json({ error: 'Failed to fetch bookmakers' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
