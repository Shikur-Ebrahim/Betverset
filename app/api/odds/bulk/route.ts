import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


const MAX_BULK_FIXTURE_IDS = 120;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get('ids') || searchParams.get('fixture_ids') || '';
    
    if (!raw.trim()) {
      return NextResponse.json({});
    }

    const ids = raw
      .split(/[,\s]+/)
      .filter(Boolean)
      .slice(0, MAX_BULK_FIXTURE_IDS);

    if (ids.length === 0) {
      return NextResponse.json({});
    }

    const byFixture: Record<string, any[]> = {};

    // Firestore 'in' query supports max 10 items per chunk
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 10) {
      chunks.push(ids.slice(i, i + 10));
    }

    await Promise.all(chunks.map(async (chunk) => {
      const snapshot = await db.collection('odds')
        .where('fixture_id', 'in', chunk)
        .get();
        
      snapshot.docs.forEach((doc: any) => {
        const data = doc.data();
        if (!data.odd_value || data.odd_value <= 0) return;
        const fid = String(data.fixture_id);
        if (!byFixture[fid]) byFixture[fid] = [];
        byFixture[fid].push({ id: doc.id, ...data });
      });
    }));

    return NextResponse.json(byFixture, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (err: any) {
    console.error('Bulk odds error:', err);
    return NextResponse.json({});
  }
}

export const dynamic = 'force-dynamic';
