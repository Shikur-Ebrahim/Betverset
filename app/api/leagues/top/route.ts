import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const { data: leagues, error } = await supabaseAdmin
      .from('leagues')
      .select('*')
      .eq('is_top', true)
      .limit(15);
      
    if (error) throw error;
      
    const topLeagues = (leagues || []).sort((a: any, b: any) => (a.top_rank ?? 999) - (b.top_rank ?? 999));
    return NextResponse.json(topLeagues);
  } catch (err: any) {
    console.error('Failed to fetch top leagues:', err);
    return NextResponse.json({ error: 'Failed to fetch top leagues' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
