import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { formatFixtureRow } from '@/lib/fixture-format';

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { data: doc, error } = await supabaseAdmin.from('fixtures').select('*').eq('id', params.id).single();

    if (error || !doc) {
      return NextResponse.json({ message: 'Fixture not found' }, { status: 404 });
    }

    return NextResponse.json(formatFixtureRow(doc));
  } catch (err: any) {
    console.error(`Error fetching fixture ${params.id}:`, err);
    return NextResponse.json({ message: 'Failed to fetch fixture' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
