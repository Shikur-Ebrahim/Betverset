import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyUser, unauthorized } from '@/lib/auth-helper';


export async function GET(req: Request) {
  const userId = await verifyUser(req);
  if (!userId) return unauthorized();

  try {
    const snapshot = await db.collection('deposit_requests')
      .where('user_id', '==', userId)
      .get();

    let docs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    docs.sort((a: any, b: any) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });

    const history = await Promise.all(docs.map(async (data: any) => {
      let method_name = '';
      let method_logo = '';
      
      if (data.method_id) {
        const methodDoc = await db.collection('deposit_methods').doc(String(data.method_id)).get();
        if (methodDoc.exists) {
          method_name = methodDoc.data()?.name || '';
          method_logo = methodDoc.data()?.logo_url || '';
        }
      }

      return {
        id: doc.id,
        ...data,
        method_name,
        method_logo,
      };
    }));

    return NextResponse.json(history);
  } catch (err: any) {
    console.error('Error fetching deposit history:', err);
    return NextResponse.json({ message: 'Failed to fetch deposit history' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
