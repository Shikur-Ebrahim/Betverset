import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';

// POST /api/admin/withdrawal-requests/[id]/approve
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ message: 'Only pending requests can be approved' }, { status: 400 });
    }

    await supabaseAdmin.from('withdrawal_requests').update({
      status: 'approved',
      updated_at: new Date().toISOString(),
    }).eq('id', params.id);

    return NextResponse.json({ message: 'Withdrawal approved successfully' });
  } catch (err: any) {
    console.error('Error approving withdrawal:', err);
    return NextResponse.json({ message: err.message || 'Failed to approve withdrawal' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
