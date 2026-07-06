import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';

// PATCH /api/admin/users/[id]/balance
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { amount } = await req.json();
    const newBalance = parseFloat(String(amount));
    if (!Number.isFinite(newBalance)) {
      return NextResponse.json({ message: 'Invalid balance amount' }, { status: 400 });
    }

    const { data: userData, error: fetchError } = await supabaseAdmin.from('users').select('id').eq('id', params.id).single();
    if (fetchError || !userData) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    await supabaseAdmin.from('users').update({
      balance: newBalance
    }).eq('id', params.id);

    return NextResponse.json({ message: 'Balance updated', balance: newBalance });
  } catch (err: any) {
    console.error('Error updating balance:', err);
    return NextResponse.json({ message: 'Failed to update balance' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
