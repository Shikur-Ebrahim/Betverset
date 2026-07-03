import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


// GET /api/admin/deposit-requests/count
export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const snapshot = await db.collection('deposit_requests')
      .where('status', '==', 'pending')
      .get();
    return NextResponse.json({ count: snapshot.size });
  } catch (err: any) {
    console.error('Error fetching deposit count:', err);
    return NextResponse.json({ message: 'Failed to fetch deposit count' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
