import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
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
    let amountDeducted: number | null = null;
    let balanceAfter: number | null = null;
    let wasApproved = false;

    await db.runTransaction(async (transaction: any) => {
      const depositRef = db.collection('deposit_requests').doc(params.id);
      const depositDoc = await transaction.get(depositRef);

      if (!depositDoc.exists) throw new Error('NOT_FOUND');

      const row = depositDoc.data()!;
      const amount = parseFloat(String(row.amount));

      if (row.status === 'approved') {
        wasApproved = true;
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error('Invalid deposit amount on record');
        }
        const userRef = db.collection('users').doc(String(row.user_id));
        const userDoc = await transaction.get(userRef);
        const currentBalance = Number(userDoc.data()?.balance) || 0;
        const newBalance = currentBalance - amount;
        transaction.update(userRef, { balance: newBalance });
        amountDeducted = amount;
        balanceAfter = newBalance;
      }

      transaction.delete(depositRef);
    });

    if (wasApproved) {
      return NextResponse.json({
        message: 'Verified deposit deleted and amount deducted from user balance',
        balanceAfter,
        amountDeducted,
      });
    }
    return NextResponse.json({ message: 'Deposit request rejected and deleted' });
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') {
      return NextResponse.json({ message: 'Request not found' }, { status: 404 });
    }
    console.error('Error deleting deposit request:', err);
    return NextResponse.json({ message: err.message || 'Failed to delete deposit request' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
