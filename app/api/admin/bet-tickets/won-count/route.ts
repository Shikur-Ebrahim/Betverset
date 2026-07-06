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
      .from('bet_slips')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'won');
    
    if (error) throw error;
    return NextResponse.json({ count: count || 0 });
  } catch (err: any) {
    console.error('Bet tickets won count error:', err);
    return NextResponse.json({ message: 'Failed to fetch winning ticket count' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
