import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';


export async function GET(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    return NextResponse.json({
      balance: Number(userData?.balance) || 0,
      currency: userData?.currency || 'ETB',
    });
  } catch (err: any) {
    console.error('Wallet fetch error:', err);
    return NextResponse.json({ message: 'Failed to load wallet' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
