import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const snapshot = await db.collection('players')
      .where('team_id', '==', parseInt(params.id, 10))
      .get();
      
    const players = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => {
        if (a.position !== b.position) return (a.position || '').localeCompare(b.position || '');
        return (a.name || '').localeCompare(b.name || '');
      });

    return NextResponse.json(players);
  } catch (err: any) {
    console.error('Failed to fetch players:', err);
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
