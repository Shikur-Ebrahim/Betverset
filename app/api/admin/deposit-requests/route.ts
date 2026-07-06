import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


// GET /api/admin/deposit-requests
export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { data: docs, error } = await supabaseAdmin
      .from('deposit_requests')
      .select('*')
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    const requests = await Promise.all((docs || []).map(async (data: any) => {
      let phone = '';
      let method_name = '';

      if (data.user_id) {
        const { data: user } = await supabaseAdmin.from('users').select('phone').eq('id', data.user_id).single();
        if (user) phone = user.phone || '';
      }
      if (data.method_id) {
        const { data: method } = await supabaseAdmin.from('deposit_methods').select('name').eq('id', data.method_id).single();
        if (method) method_name = method.name || '';
      }

      return { ...data, phone, method_name };
    }));

    return NextResponse.json(requests);
  } catch (err: any) {
    console.error('Error fetching deposit requests:', err);
    return NextResponse.json({ message: 'Failed to fetch deposit requests' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
