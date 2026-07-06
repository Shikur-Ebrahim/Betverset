import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';

export async function GET(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const { data: requests, error } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const enriched = await Promise.all((requests || []).map(async (row: any) => {
      let method_name = '';
      if (row.method_id) {
        const { data: method } = await supabaseAdmin.from('withdrawal_methods').select('name').eq('id', row.method_id).single();
        if (method) method_name = method.name || '';
      }
      return { ...row, method_name };
    }));

    return NextResponse.json(enriched);
  } catch (err: any) {
    console.error('Error fetching withdrawal history:', err);
    return NextResponse.json({ message: 'Failed to fetch withdrawal history' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
