import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyUser } from '@/lib/auth-helper';

export async function GET(req: Request) {
  try {
    const userId = await verifyUser(req);
    
    let hasPending = false;
    if (userId) {
      const { data: pendingRequests } = await supabaseAdmin
        .from('deposit_requests')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .limit(1);
      
      hasPending = Boolean(pendingRequests && pendingRequests.length > 0);
    }

    const { data: methods, error } = await supabaseAdmin
      .from('deposit_methods')
      .select('*')
      .eq('is_active', true)
      .order('name');
      
    if (error) throw error;
    
    return NextResponse.json({ hasPending, methods: methods || [] });
  } catch (err: any) {
    console.error('Error fetching deposit methods:', err);
    return NextResponse.json({ hasPending: false, methods: [] });
  }
}

export const dynamic = 'force-dynamic';
