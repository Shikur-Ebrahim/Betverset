import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const day = searchParams.get('day');
    const country = searchParams.get('country');
    const status = searchParams.get('status');

    let query: any = db.collection('fixtures');

    const now = new Date();
    query = query.where('match_date', '>=', new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString());
    query = query.orderBy('match_date', 'asc').limit(limit);

    const snapshot = await query.get();

    const fixtures: any[] = [];

    snapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      
      if (country && country !== 'All countries' && data.country_name !== country) return;
      if (status && data.status !== status) return;
      
      fixtures.push({ id: doc.id, ...data });
    });

    return NextResponse.json(fixtures);
  } catch (err: any) {
    console.error('[fixtures] list failed:', err);
    return NextResponse.json([]);
  }
}

export const dynamic = 'force-dynamic';
