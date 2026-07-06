import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';

export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { data: requests, error } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('*')
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    const enriched = await Promise.all((requests || []).map(async (row: any) => {
      let phone = '';
      let method_name = '';

      if (row.user_id) {
        const { data: user } = await supabaseAdmin.from('users').select('phone').eq('id', row.user_id).single();
        if (user) phone = user.phone || '';
      }
      if (row.method_id) {
        const { data: method } = await supabaseAdmin.from('withdrawal_methods').select('name').eq('id', row.method_id).single();
        if (method) method_name = method.name || '';
      }

      return { ...row, phone, method_name };
    }));

    return NextResponse.json(enriched);
  } catch (err: any) {
    console.error('Error fetching withdrawal requests:', err);
    return NextResponse.json({ message: 'Failed to fetch withdrawal requests' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
