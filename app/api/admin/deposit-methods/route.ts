import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { verifyAdmin, forbidden, unauthorized } from '@/lib/auth-helper';


// POST /api/admin/deposit-methods - Add deposit method
export async function POST(req: Request) {
  const adminId = await verifyAdmin(req);
  if (!adminId) {
    const authHeader = req.headers.get('authorization');
    return authHeader ? forbidden() : unauthorized();
  }

  try {
    const { name, logoUrl, minAmount, accountDetails, accountName } = await req.json();
    const docRef = db.collection('deposit_methods').doc();
    const data = {
      id: docRef.id,
      name,
      logo_url: logoUrl,
      min_amount: minAmount,
      account_details: accountDetails,
      account_name: accountName,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await docRef.set(data);
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('Error adding deposit method:', err);
    return NextResponse.json({ message: 'Failed to add deposit method' }, { status: 500 });
  }
}

// GET /api/admin/deposit-methods - Get all active deposit methods
export async function GET(req: Request) {
  try {
    const snapshot = await db.collection('deposit_methods')
      .where('active', '==', true)
      .get();
    let methods = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    methods.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    return NextResponse.json(methods);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json([], { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
