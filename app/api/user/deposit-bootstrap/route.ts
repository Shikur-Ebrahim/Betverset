import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyUser } from '@/lib/auth-helper';


export async function GET(req: Request) {
  try {
    // Always load methods (public data - no auth needed)
    const methodsSnapshot = await db.collection('deposit_methods')
      .where('active', '==', true)
      .get();

    let methods = methodsSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    methods.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

    // Optionally check pending status if user is logged in
    let hasPending = false;
    try {
      const userId = await verifyUser(req);
      if (userId) {
        const requestsSnapshot = await db.collection('deposit_requests')
          .where('user_id', '==', userId)
          .get();
        hasPending = requestsSnapshot.docs.some((doc: any) => doc.data().status === 'pending');
      }
    } catch {
      // Ignore auth errors - just show methods without pending check
    }

    return NextResponse.json({ hasPending, methods });
  } catch (err: any) {
    console.error('Error in deposit-bootstrap:', err);
    return NextResponse.json({ hasPending: false, methods: [] }, { status: 200 });
  }
}

export const dynamic = 'force-dynamic';
