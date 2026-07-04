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
    const snapshot = await db.collection('deposit_requests').get();

    let docs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    // Filter in memory to avoid composite index requirements
    docs = docs.filter((d: any) => d.status === 'pending' || d.status === 'approved');
    // Sort descending by created_at
    docs.sort((a: any, b: any) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });

    const requests = await Promise.all(docs.map(async (data: any) => {
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
