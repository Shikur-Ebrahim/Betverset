import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { searchParams } = new URL(req.url);
    const league_id = searchParams.get('league_id');
    const season = searchParams.get('season');

    let query = supabaseAdmin.from('team_statistics').select('*').eq('team_id', params.id);
    if (league_id) query = query.eq('league_id', league_id);
    if (season) query = query.eq('season', season);

    const { data: stats, error } = await query.single();
    if (error && error.code !== '42P01') throw error;

    return NextResponse.json(stats || {});
  } catch (err: any) {
    console.error(`Failed to fetch team statistics ${params.id}:`, err);
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
