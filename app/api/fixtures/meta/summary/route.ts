import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  try {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    
    const { data: fixtures, error } = await supabaseAdmin
      .from('fixtures')
      .select('*')
      .gte('match_date', cutoffDate);
      
    if (error) throw error;
    
    const countriesMap = new Map();
    (fixtures || []).forEach((f: any) => {
      const c = f.country_name || 'International';
      if (!countriesMap.has(c)) {
        countriesMap.set(c, { name: c, count: 0, flag_url: f.flag_url || null });
      }
      countriesMap.get(c).count++;
    });
    
    const countries = Array.from(countriesMap.values()).sort((a, b) => b.count - a.count);
    const total = (fixtures || []).length;

    const payload = {
      total,
      days: [{ id: 'all', count: total }],
      countries
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('[fixtures/meta/summary]', err);
    return NextResponse.json({
      total: 0,
      days: [],
      countries: []
    });
  }
}

export const dynamic = 'force-dynamic';
