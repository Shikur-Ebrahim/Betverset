import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const snapshot = await db.collection('fixtures').get();
    const fixtures = snapshot.docs.map(d => ({ id: d.id, date: d.data().match_date, home: d.data().home_team_name }));
    return NextResponse.json({ total: fixtures.length, fixtures });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
export const dynamic = 'force-dynamic';
