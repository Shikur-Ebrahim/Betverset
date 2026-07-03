import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


// DELETE /api/admin/withdrawal-requests/[id] - Reject & refund
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    await db.runTransaction(async (transaction: any) => {
      const reqRef = db.collection('withdrawal_requests').doc(params.id);
      const reqDoc = await transaction.get(reqRef);

      if (!reqDoc.exists || reqDoc.data()?.status !== 'pending') {
        throw new Error('NOT_FOUND');
      }

      const { user_id, amount } = reqDoc.data()!;
      const userRef = db.collection('users').doc(String(user_id));
      const userDoc = await transaction.get(userRef);
      const currentBalance = Number(userDoc.data()?.balance) || 0;

      transaction.update(userRef, { balance: currentBalance + Number(amount) });
      transaction.update(reqRef, { status: 'rejected', updated_at: new Date().toISOString() });
    });

    return NextResponse.json({ message: 'Withdrawal rejected; balance refunded to user' });
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') {
      return NextResponse.json({ message: 'Request not found or already processed' }, { status: 404 });
    }
    console.error('withdrawal reject:', err);
    return NextResponse.json({ message: 'Failed to reject withdrawal' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
