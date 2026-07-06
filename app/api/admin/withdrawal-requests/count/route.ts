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
    const { count, error } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    if (error) throw error;
    return NextResponse.json({ count: count || 0 });
  } catch (err: any) {
    console.error('Error fetching withdrawal count:', err);
    return NextResponse.json({ message: 'Failed to fetch withdrawal count' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
