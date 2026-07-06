import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const league_id = searchParams.get('league_id');

    let query = supabaseAdmin.from('teams').select('*').order('name', { ascending: true });

    if (league_id) {
      query = query.eq('league_id', parseInt(league_id, 10));
    }

    const { data: teams, error } = await query;
    if (error && error.code !== '42P01') throw error;

    return NextResponse.json(teams || []);
  } catch (err: any) {
    console.error('Failed to fetch teams:', err);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
