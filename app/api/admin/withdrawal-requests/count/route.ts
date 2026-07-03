import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const snapshot = await db.collection('withdrawal_requests')
      .where('status', '==', 'pending')
      .get();
    return NextResponse.json({ count: snapshot.size });
  } catch (err: any) {
    console.error('withdrawal-requests count:', err);
    return NextResponse.json({ message: 'Failed to fetch withdrawal count' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
