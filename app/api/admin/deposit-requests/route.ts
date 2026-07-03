import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


// GET /api/admin/deposit-requests
export async function GET(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const snapshot = await db.collection('deposit_requests')
      .where('status', 'in', ['pending', 'approved'])
      .orderBy('created_at', 'desc')
      .get();

    const requests = await Promise.all(snapshot.docs.map(async (doc: any) => {
      const data = doc.data();
      let phone = '';
      let method_name = '';

      if (data.user_id) {
        const userDoc = await db.collection('users').doc(String(data.user_id)).get();
        if (userDoc.exists) phone = userDoc.data()?.phone || '';
      }
      if (data.method_id) {
        const methodDoc = await db.collection('deposit_methods').doc(String(data.method_id)).get();
        if (methodDoc.exists) method_name = methodDoc.data()?.name || '';
      }

      return { id: doc.id, ...data, phone, method_name };
    }));

    return NextResponse.json(requests);
  } catch (err: any) {
    console.error('Error fetching deposit requests:', err);
    return NextResponse.json({ message: 'Failed to fetch deposit requests' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
