import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';

export async function POST(req: Request) {
  const tokenUserId = await verifyUser(req);
  if (!tokenUserId) return unauthorized();

  try {
    const { bet_slip_id } = await req.json();
    if (!bet_slip_id) {
      return NextResponse.json({ message: 'Missing bet_slip_id' }, { status: 400 });
    }

    const { data: slip, error: fetchError } = await supabaseAdmin
      .from('bet_slips')
      .select('*')
      .eq('id', bet_slip_id)
      .single();

    if (fetchError || !slip) {
      return NextResponse.json({ message: 'Bet slip not found' }, { status: 404 });
    }

    if (slip.user_id !== tokenUserId) {
      return NextResponse.json({ message: 'Cannot cash out another user\'s bet' }, { status: 403 });
    }

    if (slip.status !== 'pending') {
      return NextResponse.json({ message: `Cannot cashout a ticket that is already ${slip.status}` }, { status: 400 });
    }

    const { data: existingCashout } = await supabaseAdmin
      .from('cashout_requests')
      .select('id')
      .eq('bet_slip_id', bet_slip_id)
      .limit(1);

    if (existingCashout && existingCashout.length > 0) {
      return NextResponse.json({ message: 'Cashout request already pending' }, { status: 400 });
    }

    const offer = Number(slip.stake) * 0.8;
    if (offer < 1) {
      return NextResponse.json({ message: 'Cashout offer too low' }, { status: 400 });
    }

    await supabaseAdmin.from('cashout_requests').insert({
      user_id: tokenUserId,
      bet_slip_id: bet_slip_id,
      ticket_code: slip.ticket_code || '',
      offer_amount: offer,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    return NextResponse.json({ message: 'Cashout request submitted', offer_amount: offer });
  } catch (err: any) {
    console.error('Cashout request err:', err);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
