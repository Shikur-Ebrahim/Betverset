import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


// PATCH /api/admin/users/[id]/balance
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const body = await req.json();
    const balance = parseFloat(String(body?.balance));

    if (!Number.isFinite(balance) || balance < 0) {
      return NextResponse.json({ message: 'Balance must be a non-negative number' }, { status: 400 });
    }

    const userRef = db.collection('users').doc(params.id);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    await userRef.update({ balance, currency: 'ETB' });

    return NextResponse.json({
      message: 'Balance updated',
      id: params.id,
      balance: balance.toFixed(2),
      currency: 'ETB',
    });
  } catch (err: any) {
    console.error('Admin update balance error:', err);
    return NextResponse.json({ message: 'Failed to update balance' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
