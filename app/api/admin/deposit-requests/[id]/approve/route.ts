import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


// POST /api/admin/deposit-requests/[id]/approve
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { data: depositRow, error } = await supabaseAdmin
      .from('deposit_requests')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !depositRow || depositRow.status !== 'pending') {
      return NextResponse.json({ message: 'Request not found or already processed' }, { status: 404 });
    }

    const { user_id, amount } = depositRow;
    const { data: userData } = await supabaseAdmin.from('users').select('balance').eq('id', user_id).single();
    const currentBalance = Number(userData?.balance) || 0;

    await supabaseAdmin.from('deposit_requests').update({
      status: 'approved',
      updated_at: new Date().toISOString(),
    }).eq('id', params.id);

    await supabaseAdmin.from('users').update({
      balance: currentBalance + Number(amount)
    }).eq('id', user_id);

    return NextResponse.json({ message: 'Deposit approved and balance updated' });
  } catch (err: any) {
    console.error('Error approving deposit:', err);
    return NextResponse.json({ message: err.message || 'Failed to approve deposit' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
