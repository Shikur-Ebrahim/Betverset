import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { data: team, error } = await supabaseAdmin.from('teams').select('*').eq('id', params.id).single();
    if (error && error.code !== '42P01') throw error;
    
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json(team);
  } catch (err: any) {
    console.error(`Failed to fetch team ${params.id}:`, err);
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
