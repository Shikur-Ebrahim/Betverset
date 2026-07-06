import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request, props: { params: Promise<{ fixtureId: string }> }) {
  const params = await props.params;
  try {
    const { data: events, error } = await supabaseAdmin
      .from('live_events')
      .select('*')
      .eq('fixture_id', params.fixtureId)
      .order('minute', { ascending: true });

    if (error && error.code !== '42P01') throw error; // Ignore table not found

    return NextResponse.json(events || []);
  } catch (err: any) {
    console.error('Failed to fetch live events:', err);
    return NextResponse.json({ error: 'Failed to fetch live events' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
