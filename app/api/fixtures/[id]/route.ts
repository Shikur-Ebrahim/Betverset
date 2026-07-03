import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const fixtureId = params.id;
    if (!fixtureId) {
      return NextResponse.json({ error: 'Invalid fixture id' }, { status: 400 });
    }

    const doc = await db.collection('fixtures').doc(fixtureId).get();
    
    if (!doc.exists) {
      return NextResponse.json({ error: 'Fixture not found' }, { status: 404 });
    }

    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (err: any) {
    console.error('Failed to fetch fixture:', err);
    return NextResponse.json({ error: 'Failed to fetch fixture' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
