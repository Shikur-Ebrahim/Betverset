import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { data: doc, error } = await supabaseAdmin.from('leagues').select('*').eq('id', params.id).single();

    if (error || !doc) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    return NextResponse.json(doc);
  } catch (err: any) {
    console.error(`Failed to fetch league ${params.id}:`, err);
    return NextResponse.json({ error: 'Failed to fetch league' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
