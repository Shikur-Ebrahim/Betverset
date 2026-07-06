import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { data: players, error } = await supabaseAdmin
      .from('players')
      .select('*')
      .eq('team_id', params.id);
      
    if (error && error.code !== '42P01') throw error;

    return NextResponse.json(players || []);
  } catch (err: any) {
    console.error(`Failed to fetch players for team ${params.id}:`, err);
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
