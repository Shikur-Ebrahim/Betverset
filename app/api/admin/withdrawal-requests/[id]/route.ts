import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';

// DELETE /api/admin/withdrawal-requests/[id] - Reject and refund
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { data: requestRow, error: fetchError } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !requestRow) {
      return NextResponse.json({ message: 'Request not found' }, { status: 404 });
    }

    if (requestRow.status !== 'pending') {
      return NextResponse.json({ message: 'Only pending requests can be rejected' }, { status: 400 });
    }

    const { user_id, amount } = requestRow;

    const { data: userData } = await supabaseAdmin.from('users').select('balance').eq('id', user_id).single();
    const currentBalance = Number(userData?.balance) || 0;

    await supabaseAdmin.from('withdrawal_requests').update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
    }).eq('id', params.id);

    await supabaseAdmin.from('users').update({
      balance: currentBalance + Number(amount)
    }).eq('id', user_id);

    return NextResponse.json({ message: 'Withdrawal rejected and amount refunded to user' });
  } catch (err: any) {
    console.error('Error rejecting withdrawal:', err);
    return NextResponse.json({ message: err.message || 'Failed to reject withdrawal' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
