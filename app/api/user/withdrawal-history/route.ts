import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';


export async function GET(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const snapshot = await db.collection('withdrawal_requests')
      .where('user_id', '==', userId)
      .orderBy('created_at', 'desc')
      .limit(100)
      .get();

    const history = await Promise.all(snapshot.docs.map(async (doc: any) => {
      const data = doc.data();
      let method_name = '';
      let method_type = '';
      
      if (data.method_id) {
        const methodDoc = await db.collection('withdrawal_methods').doc(String(data.method_id)).get();
        if (methodDoc.exists) {
          method_name = methodDoc.data()?.name || '';
          method_type = methodDoc.data()?.type || '';
        }
      }

      return {
        id: doc.id,
        ...data,
        method_name,
        method_type,
      };
    }));

    return NextResponse.json(history);
  } catch (err: any) {
    console.error('withdrawal-history error:', err);
    return NextResponse.json({ message: 'Failed to fetch withdrawal history' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
