import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    const { data: methods, error } = await supabaseAdmin
      .from('deposit_methods')
      .select('*')
      .eq('is_active', true)
      .order('name');
      
    if (error) throw error;
    return NextResponse.json(methods || []);
  } catch (err: any) {
    console.error('Error fetching deposit methods:', err);
    return NextResponse.json({ message: 'Failed to fetch deposit methods' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
