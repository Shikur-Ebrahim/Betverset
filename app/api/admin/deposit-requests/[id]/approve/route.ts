import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
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
    await db.runTransaction(async (transaction: any) => {
      const depositRef = db.collection('deposit_requests').doc(params.id);
      const depositDoc = await transaction.get(depositRef);

      if (!depositDoc.exists || depositDoc.data()?.status !== 'pending') {
        throw new Error('Request not found or already processed');
      }

      const { user_id, amount } = depositDoc.data()!;
      const userRef = db.collection('users').doc(String(user_id));

      transaction.update(depositRef, {
        status: 'approved',
        updated_at: new Date().toISOString(),
      });

      const userDoc = await transaction.get(userRef);
      const currentBalance = Number(userDoc.data()?.balance) || 0;
      transaction.update(userRef, { balance: currentBalance + Number(amount) });
    });

    return NextResponse.json({ message: 'Deposit approved and balance updated' });
  } catch (err: any) {
    console.error('Error approving deposit:', err);
    return NextResponse.json({ message: err.message || 'Failed to approve deposit' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
