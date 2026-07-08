import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { formatFixtureRows } from '@/lib/fixture-format';

export async function GET() {
  try {
    const { data: fixtures, error } = await supabaseAdmin
      .from('fixtures')
      .select('*')
      .in('status', ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE'])
      .order('kickoff_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(formatFixtureRows(fixtures || []));
  } catch (err: any) {
    console.error('fixtures live error:', err);
    return NextResponse.json({ message: 'Failed to fetch live fixtures' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
