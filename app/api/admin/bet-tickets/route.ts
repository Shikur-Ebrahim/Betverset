import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


// GET /api/admin/bet-tickets
export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { data: slips, error } = await supabaseAdmin
      .from('bet_slips')
      .select('*')
      .neq('is_manual_preset', true)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    // Enrich with user phone
    const tickets = await Promise.all((slips || []).map(async (slip: any) => {
      let user_phone = '';
      if (slip.user_id) {
        const { data: user } = await supabaseAdmin.from('users').select('phone').eq('id', slip.user_id).single();
        user_phone = user?.phone || '';
      }
      return { ...slip, user_phone };
    }));

    return NextResponse.json(tickets);
  } catch (err: any) {
    console.error('Admin bet tickets error:', err);
    return NextResponse.json({ message: 'Failed to fetch bet tickets' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
