import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';


export async function GET(req: Request) {
  try {
    const now = new Date();
    const fixturesSnapshot = await db.collection('fixtures')
      .where('match_date', '>=', new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString())
      .get();
      
    const fixtures = fixturesSnapshot.docs.map((doc: any) => doc.data());
    
    const countriesMap = new Map();
    fixtures.forEach((f: any) => {
      const c = f.country_name || 'International';
      if (!countriesMap.has(c)) {
        countriesMap.set(c, { name: c, count: 0, flag_url: f.flag_url || null });
      }
      countriesMap.get(c).count++;
    });
    
    const countries = Array.from(countriesMap.values()).sort((a, b) => b.count - a.count);
    const total = fixtures.length;

    const payload = {
      total,
      days: [{ id: 'all', count: total }], // Simplified for Firestore migration
      countries: [{ name: 'All countries', count: total, flag_url: null }, ...countries]
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('[fixtures/meta]', err);
    return NextResponse.json({
      total: 0,
      days: [],
      countries: []
    });
  }
}

export const dynamic = 'force-dynamic';
