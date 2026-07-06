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
    // Fetch all bet slips ordered by creation date, then filter out presets in memory
    // (Firestore '!=' operator excludes documents where the field does not exist)
    const snapshot = await db.collection('bet_slips')
      .orderBy('created_at', 'desc')
      .limit(600)
      .get();

    let validDocs = snapshot.docs.filter((doc: any) => doc.data().is_manual_preset !== true);
    
    const tickets = await Promise.all(validDocs.map(async (doc: any) => {
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
