import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


// POST /api/admin/withdrawal-requests/[id]/approve
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const docRef = db.collection('withdrawal_requests').doc(params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.status !== 'pending') {
      return NextResponse.json({ message: 'Request not found or already processed' }, { status: 404 });
    }
    await docRef.update({ status: 'approved', updated_at: new Date().toISOString() });
    return NextResponse.json({ message: 'Withdrawal marked as paid out' });
  } catch (err: any) {
    console.error('withdrawal approve:', err);
    return NextResponse.json({ message: 'Failed to approve withdrawal' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
