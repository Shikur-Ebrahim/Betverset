import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


// DELETE /api/admin/deposit-requests/[id] - Reject pending or delete approved (reverses wallet)
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { data: depositRow, error: fetchError } = await supabaseAdmin
      .from('deposit_requests')
      .select('*')
      .eq('id', params.id)
      .single();

    if (fetchError || !depositRow) {
      return NextResponse.json({ message: 'Request not found' }, { status: 404 });
    }

    let amountDeducted: number | null = null;
    let balanceAfter: number | null = null;
    const wasApproved = depositRow.status === 'approved';

    if (wasApproved) {
      const amount = parseFloat(String(depositRow.amount));
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ message: 'Invalid deposit amount on record' }, { status: 400 });
      }
      const { data: userData } = await supabaseAdmin.from('users').select('balance').eq('id', depositRow.user_id).single();
      const currentBalance = Number(userData?.balance) || 0;
      const newBalance = currentBalance - amount;
      await supabaseAdmin.from('users').update({ balance: newBalance }).eq('id', depositRow.user_id);
      amountDeducted = amount;
      balanceAfter = newBalance;
    }

    await supabaseAdmin.from('deposit_requests').delete().eq('id', params.id);

    if (wasApproved) {
      return NextResponse.json({
        message: 'Verified deposit deleted and amount deducted from user balance',
        balanceAfter,
        amountDeducted,
      });
    }
    return NextResponse.json({ message: 'Deposit request rejected and deleted' });
  } catch (err: any) {
    console.error('Error deleting deposit request:', err);
    return NextResponse.json({ message: err.message || 'Failed to delete deposit request' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
