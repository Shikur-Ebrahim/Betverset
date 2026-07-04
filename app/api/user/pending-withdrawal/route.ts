import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';


export async function GET(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const snapshot = await db.collection('withdrawal_requests')
      .where('user_id', '==', userId)
      .get();

    const pendingDoc = snapshot.docs.find((doc: any) => doc.data().status === 'pending');

    if (!pendingDoc) {
      return NextResponse.json({ hasPending: false, request: null });
    }

    const doc = pendingDoc;
    const data = doc.data();

    let method_name = '';
    if (data.method_id) {
      const methodDoc = await db.collection('withdrawal_methods').doc(String(data.method_id)).get();
      if (methodDoc.exists) {
        method_name = methodDoc.data()?.name || '';
      }
    }

    return NextResponse.json({
      hasPending: true,
      request: { id: doc.id, ...data, method_name },
    });
  } catch (err: any) {
    console.error('pending-withdrawal error:', err);
    return NextResponse.json({ message: 'Failed to check withdrawal status' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
