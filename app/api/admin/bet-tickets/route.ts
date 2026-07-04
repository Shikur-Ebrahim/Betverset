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
    // Fetch all non-preset bet slips with user phone
    const snapshot = await db.collection('bet_slips')
      .where('is_manual_preset', '!=', true)
      .get();

    const tickets = await Promise.all(snapshot.docs.map(async (doc: any) => {
      const data = doc.data();
      let user_phone = '';
      if (data.user_id) {
        const userDoc = await db.collection('users').doc(String(data.user_id)).get();
        if (userDoc.exists) user_phone = userDoc.data()?.phone || '';
      }
      return { id: doc.id, ...data, user_phone };
    }));

    tickets.sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });

    return NextResponse.json(tickets.slice(0, 500));
  } catch (err: any) {
    console.error('Admin bet tickets error:', err);
    return NextResponse.json({ message: 'Failed to fetch bet tickets' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
