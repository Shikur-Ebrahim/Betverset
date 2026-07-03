import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';


export async function POST(req: Request) {
  const tokenUserId = await verifyUser(req);
  if (!tokenUserId) return unauthorized();

  try {
    const { bet_slip_id, offer_amount } = await req.json();

    // Verify slip belongs to user
    const slipDoc = await db.collection('bet_slips').doc(bet_slip_id).get();
    if (!slipDoc.exists) {
      return NextResponse.json({ message: 'Bet slip not found' }, { status: 404 });
    }
    
    if (slipDoc.data()?.user_id !== tokenUserId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const requestRef = db.collection('cashout_requests').doc();
    const cashoutData = {
      id: requestRef.id,
      bet_slip_id,
      offer_amount,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    await requestRef.set(cashoutData);

    return NextResponse.json(cashoutData, { status: 201 });
  } catch (err: any) {
    console.error('Cashout error:', err);
    return NextResponse.json({ error: 'Failed to request cashout' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
