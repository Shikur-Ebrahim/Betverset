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
    const snapshot = await db.collection('withdrawal_requests').get();

    let docs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    docs = docs.filter((d: any) => d.status === 'pending' || d.status === 'approved');
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
        const methodDoc = await db.collection('withdrawal_methods').doc(String(data.method_id)).get();
        if (methodDoc.exists) method_name = methodDoc.data()?.name || '';
      }

      return { ...data, phone, method_name };
    }));

    return NextResponse.json(requests);
  } catch (err: any) {
    console.error('withdrawal-requests list:', err);
    return NextResponse.json({ message: 'Failed to fetch withdrawal requests' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
