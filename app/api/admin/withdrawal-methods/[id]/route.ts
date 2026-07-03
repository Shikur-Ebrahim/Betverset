import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    await db.collection('withdrawal_methods').doc(params.id)
      .update({ active: false, updated_at: new Date().toISOString() });
    return NextResponse.json({ message: 'Method deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ message: 'Failed to delete withdrawal method' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
