import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';


export async function GET(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const snapshot = await db.collection('deposit_requests')
      .where('user_id', '==', userId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    return NextResponse.json({
      hasPending: !snapshot.empty,
      request: snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() },
    });
  } catch (err: any) {
    console.error('Error checking pending deposit:', err);
    return NextResponse.json({ message: 'Failed to check pending deposit' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
