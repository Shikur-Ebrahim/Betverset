import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';

export async function GET(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const { count, error } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');
      
    if (error) throw error;
    return NextResponse.json({ count: count || 0 });
  } catch (err: any) {
    console.error('Error fetching pending withdrawals:', err);
    return NextResponse.json({ message: 'Failed to fetch pending withdrawals' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
