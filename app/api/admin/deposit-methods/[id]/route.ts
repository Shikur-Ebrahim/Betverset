import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


// PUT /api/admin/deposit-methods/[id] - Update deposit method
export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { name, logoUrl, minAmount, accountDetails, accountName } = await req.json();
    const docRef = db.collection('deposit_methods').doc(params.id);
    const doc = await docRef.get();
    if (!doc.exists) return NextResponse.json({ message: 'Method not found' }, { status: 404 });

    const updated = {
      name,
      logo_url: logoUrl,
      min_amount: minAmount,
      account_details: accountDetails,
      account_name: accountName,
      updated_at: new Date().toISOString(),
    };
    await docRef.update(updated);
    return NextResponse.json({ id: params.id, ...doc.data(), ...updated });
  } catch (err: any) {
    return NextResponse.json({ message: 'Failed to update deposit method' }, { status: 500 });
  }
}

// DELETE /api/admin/deposit-methods/[id] - Soft delete deposit method
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const docRef = db.collection('deposit_methods').doc(params.id);
    const doc = await docRef.get();
    if (!doc.exists) return NextResponse.json({ message: 'Method not found' }, { status: 404 });

    await docRef.update({ active: false, updated_at: new Date().toISOString() });
    return NextResponse.json({ message: 'Method deleted successfully', id: params.id });
  } catch (err: any) {
    return NextResponse.json({ message: 'Failed to delete deposit method' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
