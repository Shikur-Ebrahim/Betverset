import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { formatLiveMatchRow } from '@/lib/fixture-format';

// GET /api/live/matches
export async function GET() {
  try {
    const { data: fixtures, error } = await supabaseAdmin
      .from('fixtures')
      .select('*')
      .in('status', ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'])
      .order('kickoff_at', { ascending: false });

    if (error) throw error;

    const formatted = (fixtures || []).map((doc) => formatLiveMatchRow(doc));

    return NextResponse.json(formatted, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    console.error('Failed to fetch live matches:', err);
    return NextResponse.json({ error: 'Failed to fetch live matches' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
