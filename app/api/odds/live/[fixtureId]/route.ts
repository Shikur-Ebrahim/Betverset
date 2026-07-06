import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request, props: { params: Promise<{ fixtureId: string }> }) {
  const params = await props.params;
  try {
    const { data: odds, error } = await supabaseAdmin
      .from('live_odds')
      .select('*')
      .eq('fixture_id', params.fixtureId)
      .order('timestamp', { ascending: false });

    if (error && error.code !== '42P01') throw error;

    return NextResponse.json(odds || []);
  } catch (err: any) {
    console.error('Failed to fetch live odds:', err);
    return NextResponse.json({ error: 'Failed to fetch live odds' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
