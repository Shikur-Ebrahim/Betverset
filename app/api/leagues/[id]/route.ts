import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const doc = await db.collection('leagues').doc(params.id).get();
    
    if (!doc.exists) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (err: any) {
    console.error('Failed to fetch league:', err);
    return NextResponse.json({ error: 'Failed to fetch league' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
