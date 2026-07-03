import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';


export async function GET(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const [pendingSnapshot, methodsSnapshot] = await Promise.all([
      db.collection('deposit_requests')
        .where('user_id', '==', userId)
        .where('status', '==', 'pending')
        .limit(1)
        .get(),
      db.collection('deposit_methods')
        .where('active', '==', true)
        .get(),
    ]);

    const methods = methodsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({
      hasPending: !pendingSnapshot.empty,
      methods,
    });
  } catch (err: any) {
    console.error('Error in deposit-bootstrap:', err);
    return NextResponse.json({ message: 'Failed to load deposit data' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
