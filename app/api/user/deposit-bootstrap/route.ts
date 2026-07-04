import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';


export async function GET(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const [requestsSnapshot, methodsSnapshot] = await Promise.all([
      db.collection('deposit_requests')
        .where('user_id', '==', userId)
        .get(),
      db.collection('deposit_methods')
        .where('active', '==', true)
        .get(),
    ]);

    const hasPending = requestsSnapshot.docs.some((doc: any) => doc.data().status === 'pending');
    let methods = methodsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    methods.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

    return NextResponse.json({
      hasPending,
      methods,
    });
  } catch (err: any) {
    console.error('Error in deposit-bootstrap:', err);
    return NextResponse.json({ message: 'Failed to load deposit data' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
