import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const doc = await db.collection('teams').doc(params.id).get();
    
    if (!doc.exists) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }
    
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (err: any) {
    console.error('Failed to fetch team:', err);
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
